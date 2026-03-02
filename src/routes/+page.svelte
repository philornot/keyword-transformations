<script lang="ts">
    import {t} from '$lib/i18n.svelte.js';
    import type {PageData} from './$types.js';
    import type {SetSummary} from '$lib/types.js';
    import {ArrowRight, Camera, MagnifyingGlass, PencilSimple, RocketLaunch, Upload} from 'phosphor-svelte';

    let {data} = $props<{ data: PageData }>();

    const sets = $derived(data.sets as SetSummary[]);
</script>

<svelte:head>
    <title>Key word transformations</title>
</svelte:head>

<div class="home">

    <!-- ── Compact hero ──────────────────────────────────────────────── -->
    <section class="hero">
        <div class="hero-text">
            <h1 class="hero-title">{t('home.title')}</h1>
            <p class="hero-sub">{t('home.subtitle')}</p>
        </div>
        <div class="cta-row">
            <a href="/create/scan" class="cta-card cta-primary">
                <Camera size={24} weight="duotone"/>
                <div>
                    <strong>{t('home.scanTitle')}</strong>
                    <span>{t('home.scanDesc')}</span>
                </div>
            </a>
            <a href="/create/manual" class="cta-card cta-ghost">
                <PencilSimple size={24} weight="duotone"/>
                <div>
                    <strong>{t('home.manualTitle')}</strong>
                    <span>{t('home.manualDesc')}</span>
                </div>
            </a>
        </div>
    </section>

    <!-- ── Sets listing ──────────────────────────────────────────────── -->
    <section class="sets-section">
        <h2 class="section-title">{t('home.setsTitle')}</h2>

        {#if sets.length === 0}
            <div class="no-sets card">
                <p>{t('home.noSets')}</p>
            </div>
        {:else}
            <div class="sets-grid">
                {#each sets as s (s.slug)}
                    <a href="/set/{s.slug}" class="set-card card">
                        {#if s.sourceLabel}
                            <span class="source-badge">{s.sourceLabel}</span>
                        {/if}
                        <strong class="set-title">{s.title}</strong>
                        <span class="set-meta">{t('home.questionsCount', {n: s.questionCount})}</span>
                        <span class="solve-link">
              {t('home.solveNow')}
                            <ArrowRight size={14} weight="bold"/>
            </span>
                    </a>
                {/each}
            </div>
        {/if}
    </section>

    <!-- ── How it works ──────────────────────────────────────────────── -->
    <section class="how">
        <h2 class="section-title">How it works</h2>
        <div class="steps">
            <div class="step card">
                <div class="step-icon">
                    <Upload size={22} weight="duotone"/>
                </div>
                <div class="step-num">1</div>
                <strong>{t('home.step1')}</strong>
                <p>{t('home.step1desc')}</p>
            </div>
            <div class="step-arrow">→</div>
            <div class="step card">
                <div class="step-icon">
                    <MagnifyingGlass size={22} weight="duotone"/>
                </div>
                <div class="step-num">2</div>
                <strong>{t('home.step2')}</strong>
                <p>{t('home.step2desc')}</p>
            </div>
            <div class="step-arrow">→</div>
            <div class="step card">
                <div class="step-icon">
                    <RocketLaunch size={22} weight="duotone"/>
                </div>
                <div class="step-num">3</div>
                <strong>{t('home.step3')}</strong>
                <p>{t('home.step3desc')}</p>
            </div>
        </div>
    </section>
</div>

<style>
    .home {
        display: flex;
        flex-direction: column;
        gap: var(--space-12);
    }

    /* ── Hero ─────────────────────────────────────────────────────────── */
    .hero {
        display: flex;
        flex-direction: column;
        gap: var(--space-6);
        padding: var(--space-6) 0 0;
    }

    .hero-title {
        font-size: var(--font-size-4xl);
        font-weight: var(--font-weight-black);
        line-height: var(--line-height-tight);
        letter-spacing: var(--letter-spacing-tight);
    }

    .hero-sub {
        font-size: var(--font-size-base);
        color: var(--color-text-muted);
        max-width: 560px;
        line-height: var(--line-height-base);
        margin-top: var(--space-2);
    }

    .cta-row {
        display: flex;
        gap: var(--space-3);
        flex-wrap: wrap;
    }

    .cta-card {
        flex: 1;
        min-width: 220px;
        display: flex;
        align-items: center;
        gap: var(--space-3);
        padding: var(--space-4) var(--space-5);
        border-radius: var(--radius-xl);
        text-decoration: none;
        transition: transform var(--transition-base), box-shadow var(--transition-base);
    }

    .cta-card:hover {
        transform: translateY(-2px);
        box-shadow: var(--shadow-lg);
        text-decoration: none;
    }

    .cta-primary {
        background: var(--color-primary);
        color: var(--color-surface);
        box-shadow: var(--shadow-md);
    }

    .cta-ghost {
        background: var(--color-surface);
        color: var(--color-text);
        border: 2px solid var(--color-border);
        box-shadow: var(--shadow-sm);
    }

    .cta-card div {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .cta-primary strong {
        color: var(--color-surface);
        font-size: var(--font-size-sm);
    }

    .cta-primary span {
        color: rgba(255, 255, 255, 0.75);
        font-size: var(--font-size-xs);
    }

    .cta-ghost strong {
        color: var(--color-text);
        font-size: var(--font-size-sm);
    }

    .cta-ghost span {
        color: var(--color-text-muted);
        font-size: var(--font-size-xs);
    }

    /* ── Section shared ───────────────────────────────────────────────── */
    .section-title {
        font-size: var(--font-size-xl);
        font-weight: var(--font-weight-extrabold);
        margin-bottom: var(--space-4);
    }

    /* ── Sets grid ────────────────────────────────────────────────────── */
    .sets-section {
        display: flex;
        flex-direction: column;
    }

    .no-sets {
        text-align: center;
        color: var(--color-text-faint);
        padding: var(--space-8);
    }

    .sets-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
        gap: var(--space-4);
    }

    .set-card {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        text-decoration: none;
        color: var(--color-text);
        transition: transform var(--transition-base), box-shadow var(--transition-base);
        padding: var(--space-5);
    }

    .set-card:hover {
        transform: translateY(-2px);
        box-shadow: var(--shadow-lg);
        text-decoration: none;
    }

    .source-badge {
        display: inline-block;
        align-self: flex-start;
        background: var(--color-primary-muted);
        color: var(--color-primary);
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-bold);
        padding: 2px var(--space-2);
        border-radius: var(--radius-full);
        letter-spacing: var(--letter-spacing-wide);
        text-transform: uppercase;
    }

    .set-title {
        font-size: var(--font-size-base);
        font-weight: var(--font-weight-bold);
        line-height: var(--line-height-snug);
        flex: 1;
    }

    .set-meta {
        font-size: var(--font-size-xs);
        color: var(--color-text-muted);
    }

    .solve-link {
        display: flex;
        align-items: center;
        gap: var(--space-1);
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-semibold);
        color: var(--color-primary);
        margin-top: var(--space-1);
    }

    /* ── How it works ─────────────────────────────────────────────────── */
    .how {
        display: flex;
        flex-direction: column;
    }

    .steps {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        flex-wrap: wrap;
    }

    .step {
        flex: 1;
        min-width: 180px;
        max-width: 240px;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: var(--space-2);
        padding: var(--space-5) var(--space-4);
        position: relative;
    }

    .step-icon {
        color: var(--color-primary);
    }

    .step-num {
        position: absolute;
        top: var(--space-3);
        right: var(--space-3);
        background: var(--color-primary-muted);
        color: var(--color-primary);
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-black);
        width: 20px;
        height: 20px;
        border-radius: var(--radius-full);
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .step strong {
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-bold);
    }

    .step p {
        font-size: var(--font-size-xs);
        color: var(--color-text-muted);
        line-height: var(--line-height-snug);
    }

    .step-arrow {
        font-size: var(--font-size-xl);
        color: var(--color-neutral-400);
        flex-shrink: 0;
    }

    @media (max-width: 600px) {
        .hero-title {
            font-size: var(--font-size-2xl);
        }

        .step-arrow {
            display: none;
        }

        .step {
            max-width: 100%;
        }
    }
</style>