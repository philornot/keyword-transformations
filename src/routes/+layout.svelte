<script lang="ts">
    import '$lib/theme.css';
    import '$lib/global.css';
    import {locale, t} from '$lib/i18n.svelte.js';
    import {mode} from '$lib/mode.svelte.js';
    import {Camera, PencilSimple, SignOut, Translate} from 'phosphor-svelte';
    import type {ExerciseType} from '$lib/constants.js';
    import {EXERCISE_TYPES} from '$lib/constants.js';

    let {children, data} = $props();

    function toggleLang() {
        locale.lang = locale.lang === 'pl' ? 'en' : 'pl';
    }

    /**
     * Changes the global exercise mode without navigating away from the
     * current page.
     *
     * @param type - The exercise type to activate.
     */
    function setMode(type: ExerciseType) {
        mode.type = type;
    }

    const typeLabels: Record<ExerciseType, string> = {
        kwt: 'KWT',
        grammar: 'Gramatykalizacja',
        translation: 'Tłumaczenia',
    };
</script>

<div class="shell">
    <header class="header">
        <a href="/" class="logo">{t('nav.home')}</a>

        <nav class="nav">
            <!-- Mode tabs — change global state, no navigation -->
            <div class="type-group" role="group" aria-label="Tryb ćwiczenia">
                {#each EXERCISE_TYPES as type}
                    <button
                            class="type-tab"
                            class:active={mode.type === type}
                            aria-pressed={mode.type === type}
                            onclick={() => setMode(type)}
                            type="button"
                    >{typeLabels[type]}</button>
                {/each}
            </div>

            <!-- Action buttons — navigate using current mode -->
            <a href="/create/scan" class="nav-link">
                <Camera size={16} weight="regular"/>
                {t('nav.scan')}
                <span class="beta-badge">{t('common.beta')}</span>
            </a>
            <a href="/create/manual" class="nav-link nav-link--primary">
                <PencilSimple size={16} weight="regular"/>
                Utwórz zestaw
            </a>

            <button class="lang-btn" onclick={toggleLang} aria-label="Toggle language">
                <Translate size={14} weight="bold"/>{t('common.langToggle')}
            </button>

            {#if data.isAdmin}
                <a href="/admin" class="nav-link">Panel</a>
                <form method="POST" action="/admin?/logout">
                    <button class="logout-btn" type="submit">
                        <SignOut size={14} weight="bold"/>
                        Wyloguj
                    </button>
                </form>
            {/if}
        </nav>
    </header>

    <main class="content">
        {@render children()}
    </main>

    <footer class="footer">
        <p>Key word transformations</p>
    </footer>
</div>

<style>
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

    /* ── Mode tab group ───────────────────────────────────────────────── */
    .type-group {
        display: flex;
        align-items: stretch;
        border: 2px solid var(--color-primary);
        border-radius: var(--radius-md);
        overflow: hidden;
    }

    .type-tab {
        display: flex;
        align-items: center;
        padding: var(--space-1) var(--space-3);
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-semibold);
        color: var(--color-primary);
        background: transparent;
        border: none;
        border-right: 1px solid var(--color-primary-muted);
        border-radius: 0;
        cursor: pointer;
        white-space: nowrap;
        transition: background var(--transition-base), color var(--transition-base);
    }

    .type-tab:last-child {
        border-right: none;
    }

    .type-tab:hover {
        background: var(--color-primary-light);
    }

    .type-tab.active {
        background: var(--color-primary);
        color: var(--color-surface);
    }

    .type-tab:active {
        transform: none;
    }

    /* ── Nav links ────────────────────────────────────────────────────── */
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

    .beta-badge {
        background: var(--color-warning);
        color: #fff;
        font-size: 0.6rem;
        font-weight: var(--font-weight-black);
        letter-spacing: var(--letter-spacing-wider);
        padding: 1px 5px;
        border-radius: var(--radius-full);
        line-height: 1.4;
        vertical-align: middle;
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

    .logout-btn {
        display: flex;
        align-items: center;
        gap: var(--space-1);
        padding: var(--space-1) var(--space-3);
        border-radius: var(--radius-sm);
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-bold);
        background: var(--color-danger-light);
        color: var(--color-danger-dark);
        letter-spacing: var(--letter-spacing-wide);
        border: none;
    }

    .logout-btn:hover {
        background: var(--color-danger);
        color: white;
    }

    @media (max-width: 640px) {
        .type-group {
            order: 1;
            width: 100%;
        }

        .type-tab {
            flex: 1;
            justify-content: center;
        }
    }
</style>