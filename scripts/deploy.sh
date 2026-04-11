#!/usr/bin/env bash
# =============================================================================
# deploy.sh — build locally and deploy to the remote
#
# Usage:
#   bash scripts/deploy.sh          # full deploy (build + sync + restart)
#   bash scripts/deploy.sh --sync   # skip build, just rsync + restart
#   bash scripts/deploy.sh --check  # dry-run: show what would be sent
#
# Requirements (local machine):
#   yq  >= 4.x  — https://github.com/mikefarah/yq
#   bun        — https://bun.sh
#   rsync
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CONFIG="$PROJECT_ROOT/deploy.config.yaml"

# ── Parse flags ───────────────────────────────────────────────────────────────

SKIP_BUILD=false
DRY_RUN=false

for arg in "$@"; do
    case $arg in
        --sync)  SKIP_BUILD=true ;;
        --check) DRY_RUN=true; SKIP_BUILD=true ;;
    esac
done

# ── Helpers ───────────────────────────────────────────────────────────────────

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
RESET='\033[0m'

info()    { echo -e "${CYAN}[deploy]${RESET} $*"; }
success() { echo -e "${GREEN}[deploy]${RESET} $*"; }
warn()    { echo -e "${YELLOW}[deploy]${RESET} $*"; }
die()     { echo -e "${RED}[deploy] ERROR:${RESET} $*" >&2; exit 1; }

cfg_get() { yq e ".$1" "$CONFIG"; }

# ── Preflight ─────────────────────────────────────────────────────────────────

command -v yq    &>/dev/null || die "yq not found. See scripts/setup.sh for install instructions."
command -v bun   &>/dev/null || die "bun not found. Install from https://bun.sh"
command -v rsync &>/dev/null || die "rsync not found."

[[ -f "$CONFIG" ]] || die "deploy.config.yaml not found. Run scripts/setup.sh first."

# ── Read config ───────────────────────────────────────────────────────────────

SSH_ALIAS=$(cfg_get    "remote.ssh_alias")
DEPLOY_PATH=$(cfg_get  "remote.deploy_path")
DATA_PATH=$(cfg_get    "remote.data_path")
PM2_NAME=$(cfg_get     "project.name")
RUNTIME=$(cfg_get      "remote.runtime")
BACKUP_ENABLED=$(cfg_get  "backup.enabled")
BACKUP_KEEP_DAYS=$(cfg_get "backup.keep_days")
ORIGIN=$(cfg_get       "app.origin")
PORT=$(cfg_get         "app.port")
ADMIN_PW=$(cfg_get     "app.admin_password")

[[ -z "$SSH_ALIAS"   || "$SSH_ALIAS"   == "null" ]] && die "remote.ssh_alias not set. Run scripts/setup.sh."
[[ -z "$DEPLOY_PATH" || "$DEPLOY_PATH" == "null" ]] && die "remote.deploy_path not set. Run scripts/setup.sh."

# Default to node if runtime was never written to config (safety fallback).
RUNTIME="${RUNTIME:-node}"
[[ "$RUNTIME" == "null" ]] && RUNTIME="node"

# ── Start ─────────────────────────────────────────────────────────────────────

echo ""
echo -e "${CYAN}══════════════════════════════════════════${RESET}"
echo -e "${CYAN}  KWT — deploying to $SSH_ALIAS ($RUNTIME)${RESET}"
echo -e "${CYAN}══════════════════════════════════════════${RESET}"
echo ""

cd "$PROJECT_ROOT"

# ── Step 1: Build ─────────────────────────────────────────────────────────────

if [[ "$SKIP_BUILD" == false ]]; then
    info "Building..."

    if command -v bun &>/dev/null; then
        bun run build
    elif command -v npm &>/dev/null; then
        npm run build
    else
        die "Neither bun nor npm found locally. Install one to build."
    fi

    success "Build complete."
    echo ""
fi

# ── Step 2: Backup database ───────────────────────────────────────────────────

if [[ "$BACKUP_ENABLED" == "true" && "$DRY_RUN" == false ]]; then
    info "Backing up database on remote..."
    ssh "$SSH_ALIAS" /bin/bash << REMOTE
set -euo pipefail
DB="${DATA_PATH}/worksheet.db"
BACKUP_DIR="${DATA_PATH}/backups"
mkdir -p "\$BACKUP_DIR"
if [[ -f "\$DB" ]]; then
    STAMP=\$(date +%Y%m%d_%H%M%S)
    if command -v sqlite3 &>/dev/null; then
        sqlite3 "\$DB" ".backup '\$BACKUP_DIR/worksheet_\${STAMP}.db'"
    else
        cp "\$DB" "\$BACKUP_DIR/worksheet_\${STAMP}.db"
    fi
    echo "[remote] Backup saved: worksheet_\${STAMP}.db"
    find "\$BACKUP_DIR" -name "worksheet_*.db" -mtime +${BACKUP_KEEP_DAYS} -delete
    echo "[remote] Old backups (>${BACKUP_KEEP_DAYS}d) cleaned up."
else
    echo "[remote] No database found yet — skipping backup."
fi
REMOTE
    echo ""
fi

# ── Step 3: Transfer files ────────────────────────────────────────────────────

LOCKFILE="bun.lock"
[[ -f "bun.lockb" ]] && LOCKFILE="bun.lockb"

if [[ "$DRY_RUN" == true ]]; then
    info "Dry run — skipping file transfer."
    warn "Dry run — nothing was changed on the remote."
    exit 0
fi

info "Transferring files to $SSH_ALIAS:$DEPLOY_PATH..."

ssh "$SSH_ALIAS" "mkdir -p '${DEPLOY_PATH}'"

tar czf - \
    --exclude='.env' \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='data' \
    build \
    package.json \
    "$LOCKFILE" \
    | ssh "$SSH_ALIAS" "tar xzf - -C '${DEPLOY_PATH}'"

success "Transfer complete."
echo ""

# ── Step 4: Update .env ───────────────────────────────────────────────────────

info "Updating .env on remote..."
ssh "$SSH_ALIAS" /bin/bash << REMOTE
cat > "${DEPLOY_PATH}/.env" << 'ENVEOF'
ADMIN_PASSWORD=${ADMIN_PW}
ORIGIN=${ORIGIN}
PORT=${PORT}
DATA_DIR=${DATA_PATH}
ENVEOF
echo "[remote] .env updated (PORT=${PORT})."
REMOTE
echo ""

# ── Step 4: Install deps + restart ───────────────────────────────────────────

info "Installing production dependencies and restarting on remote..."

if [[ "$RUNTIME" == "bun" ]]; then

ssh "$SSH_ALIAS" /bin/bash << REMOTE
set -euo pipefail
export PATH="\$HOME/.bun/bin:\$PATH"

cd "${DEPLOY_PATH}"
bun install --production --frozen-lockfile

if pm2 describe "${PM2_NAME}" &>/dev/null; then
    pm2 restart "${PM2_NAME}"
    echo "[remote] PM2 process '${PM2_NAME}' restarted."
else
    pm2 start --interpreter bun --name "${PM2_NAME}" -- build/index.js
    pm2 save
    echo "[remote] PM2 process '${PM2_NAME}' started and saved."
fi
REMOTE

else

ssh "$SSH_ALIAS" /bin/bash << REMOTE
set -euo pipefail
export NVM_DIR="\$HOME/.nvm"
source "\$NVM_DIR/nvm.sh"

cd "${DEPLOY_PATH}"
npm install --omit=dev --frozen-lockfile

if pm2 describe "${PM2_NAME}" &>/dev/null; then
    pm2 restart "${PM2_NAME}"
    echo "[remote] PM2 process '${PM2_NAME}' restarted."
else
    pm2 start --name "${PM2_NAME}" build/index.js
    pm2 save
    echo "[remote] PM2 process '${PM2_NAME}' started and saved."
fi
REMOTE

fi

echo ""
success "Deploy complete."

# ── Step 5: Health check ──────────────────────────────────────────────────────

if [[ -n "$ORIGIN" && "$ORIGIN" != "null" && "$ORIGIN" != '""' ]]; then
    info "Checking $ORIGIN ..."
    sleep 2
    HTTP_CODE=$(curl -o /dev/null -s -w "%{http_code}" --max-time 10 "$ORIGIN" || echo "000")
    if [[ "$HTTP_CODE" == "200" ]]; then
        success "App is up — HTTP $HTTP_CODE"
    else
        warn "App returned HTTP $HTTP_CODE — check logs: ssh $SSH_ALIAS 'pm2 logs ${PM2_NAME}'"
    fi
else
    info "No origin set — skipping health check."
    info "Check logs: ssh $SSH_ALIAS 'pm2 logs ${PM2_NAME}'"
fi

echo ""