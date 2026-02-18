<script lang="ts">
    import '$lib/theme.css';
    import '$lib/global.css';
    import {locale, t} from '$lib/i18n.svelte.js';
    import {Camera, PencilSimple, Translate} from 'phosphor-svelte';

    let {children} = $props();

    function toggleLang() {
        locale.lang = locale.lang === 'pl' ? 'en' : 'pl';
    }
</script>

<div class="shell">
    <header class="header">
        <a href="/" class="logo">{t('nav.home')}</a>
        <nav class="nav">
            <a href="/create/scan" class="nav-link">
                <Camera size={16} weight="regular"/>{t('nav.scan')}
            </a>
            <a href="/create/manual" class="nav-link nav-link--primary">
                <PencilSimple size={16} weight="regular"/>{t('nav.manual')}
            </a>
            <button class="lang-btn" onclick={toggleLang} aria-label="Toggle language">
                <Translate size={14} weight="bold"/>{t('common.langToggle')}
            </button>
        </nav>
    </header>

    <main class="content">
        {@render children()}
    </main>

    <footer class="footer">
        <p>Keyword Transformations</p>
    </footer>
</div>

<style>
    /* ── Shell ────────────────────────────────────────────────────────── */
    .shell {
        min-height: 100vh;
        display: flex;
        flex-direction: column;
    }

    .header {
        background: var(--color-surface);
        border-bottom: 1px solid var(--color-border-subtle);
        padding: var(--space-3) var(--space-6);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-4);
        flex-wrap: wrap;
    }

    .logo {
        font-size: var(--font-size-xl);
        font-weight: var(--font-weight-extrabold);
        color: var(--color-text);
        white-space: nowrap;
    }

    .nav {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        flex-wrap: wrap;
    }

    .nav-link {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-2) var(--space-3);
        border-radius: var(--radius-md);
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-medium);
        color: var(--color-text-muted);
        transition: background var(--transition-base), color var(--transition-base);
        white-space: nowrap;
    }

    .nav-link:hover {
        background: var(--color-neutral-100);
        color: var(--color-text);
        text-decoration: none;
    }

    .nav-link--primary {
        background: var(--color-primary);
        color: var(--color-surface);
        font-weight: var(--font-weight-semibold);
    }

    .nav-link--primary:hover {
        background: var(--color-primary-hover);
        color: var(--color-surface);
    }

    .lang-btn {
        display: flex;
        align-items: center;
        gap: var(--space-1);
        padding: var(--space-1) var(--space-3);
        border-radius: var(--radius-sm);
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-bold);
        background: var(--color-neutral-100);
        color: var(--color-text-muted);
        letter-spacing: var(--letter-spacing-wide);
    }

    .lang-btn:hover {
        background: var(--color-neutral-200);
    }

    .content {
        flex: 1;
        padding: var(--space-8) var(--space-6);
        max-width: 860px;
        width: 100%;
        margin: 0 auto;
    }

    .footer {
        text-align: center;
        padding: var(--space-5);
        color: var(--color-text-faint);
        font-size: var(--font-size-xs);
        border-top: 1px solid var(--color-border-subtle);
        background: var(--color-surface);
    }
</style>