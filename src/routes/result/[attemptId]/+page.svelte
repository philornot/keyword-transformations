<script lang="ts">
    /**
     * /result/[attemptId] — shows score and per-question KWT breakdown.
     * Each question shows the gapped sentence with the correct answer and
     * what the user typed, colour-coded green/red.
     */

    import type {PageData} from './$types.js';
    import {t} from '$lib/i18n.svelte.js';
    import {ArrowLeft, CheckFat, MedalMilitary, Trophy, XSquare} from 'phosphor-svelte';

    let {data} = $props<{ data: PageData }>();

    // Use $derived so the reference stays reactive if data changes.
    const result = $derived(data.result);

    const GAP = '______';

    const scoreColor = $derived(
        result.percentage >= 80 ? 'var(--color-success)' :
            result.percentage >= 50 ? 'var(--color-warning)' :
                'var(--color-danger)'
    );

    const verdict = $derived(
        result.percentage === 100 ? t('result.perfect') :
            result.percentage >= 80 ? t('result.great') :
                result.percentage >= 50 ? t('result.good') :
                    t('result.poor')
    );

    /**
     * Splits a gapped sentence into the parts before and after the gap.
     * @param s - Sentence containing `______` placeholder.
     * @returns [before, after] tuple.
     */
    function splitGap(s: string): [string, string] {
        const i = s.indexOf(GAP);
        if (i === -1) return [s, ''];
        return [s.slice(0, i), s.slice(i + GAP.length)];
    }
</script>

<svelte:head><title>{t('result.title', {title: result.setTitle})}</title></svelte:head>

<div class="result-page">
    <!-- Score summary -->
    <div class="score-card card">
        <div class="score-title">
            {#if result.percentage === 100}
                <MedalMilitary size={32} weight="duotone" class="trophy"/>
            {:else}
                <Trophy size={32} weight="duotone" class="trophy"/>
            {/if}
            <h1>{result.setTitle}</h1>
        </div>

        <div class="score-display">
            <span class="fraction" style="color: {scoreColor}">{result.score} / {result.total}</span>
            <span class="pct" style="color: {scoreColor}">{result.percentage}%</span>
        </div>

        <div class="bar-bg">
            <div
                    class="bar-fill"
                    style="width:{result.percentage}%; background:{scoreColor}"
                    role="progressbar"
                    aria-valuenow={result.percentage}
                    aria-valuemin={0}
                    aria-valuemax={100}
            ></div>
        </div>

        <p class="verdict">{verdict}</p>
    </div>

    <!-- Breakdown -->
    <h2>{t('result.breakdown')}</h2>

    <div class="answers">
        {#each result.answers as a (a.questionId)}
            {@const [before, after] = splitGap(a.sentence2WithGap)}
            <div class="a-card card" class:correct={a.isCorrect} class:wrong={!a.isCorrect}>
                <div class="a-header">
                    <span class="pos">{a.position}.</span>
                    <span class="badge" class:badge-ok={a.isCorrect} class:badge-err={!a.isCorrect}>
            {#if a.isCorrect}
              <CheckFat size={11} weight="bold"/> OK
            {:else}
              <XSquare size={11} weight="bold"/>
            {/if}
          </span>
                    <span class="kw-tag">{a.keyword}</span>
                </div>

                <p class="s1">{a.sentence1}</p>

                <p class="s2">
                    {before}<span
                        class="filled-answer"
                        class:answer-correct={a.isCorrect}
                        class:answer-wrong={!a.isCorrect}
                >{a.given || t('result.noAnswer')}</span>{after}
                </p>

                {#if !a.isCorrect}
                    <div class="correction">
                        <span class="corr-label">{t('result.correct')}</span>
                        <span class="corr-value">{a.correctAnswer}</span>
                    </div>
                {/if}
            </div>
        {/each}
    </div>

    <a href="/" class="btn-ghost back-btn">
        <ArrowLeft size={16} weight="regular"/> {t('result.back')}
    </a>
</div>

<style>
    .result-page {
        display: flex;
        flex-direction: column;
        gap: var(--space-6);
    }

    /* ── Score card ───────────────────────────────────────────────────── */
    .score-card {
        text-align: center;
        padding: var(--space-10) var(--space-8);
    }

    .score-title {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--space-3);
        margin-bottom: var(--space-6);
    }

    h1 {
        font-size: var(--font-size-2xl);
        font-weight: var(--font-weight-extrabold);
    }

    h2 {
        font-size: var(--font-size-lg);
        font-weight: var(--font-weight-bold);
    }

    :global(.trophy) {
        color: var(--color-warning);
    }

    .score-display {
        display: flex;
        align-items: baseline;
        justify-content: center;
        gap: var(--space-4);
        margin-bottom: var(--space-4);
    }

    .fraction {
        font-size: var(--font-size-hero);
        font-weight: var(--font-weight-black);
        line-height: 1;
    }

    .pct {
        font-size: var(--font-size-4xl);
        font-weight: var(--font-weight-bold);
    }

    .bar-bg {
        background: var(--color-neutral-200);
        border-radius: var(--radius-full);
        height: 10px;
        overflow: hidden;
        max-width: 400px;
        margin: 0 auto var(--space-4);
    }

    .bar-fill {
        height: 100%;
        border-radius: var(--radius-full);
        transition: width 0.8s ease;
    }

    .verdict {
        color: var(--color-text-muted);
        font-size: var(--font-size-md);
    }

    /* ── Answer cards ─────────────────────────────────────────────────── */
    .answers {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
    }

    .a-card {
        border-left: 4px solid transparent;
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
    }

    .a-card.correct {
        border-left-color: var(--color-success);
    }

    .a-card.wrong {
        border-left-color: var(--color-danger);
    }

    .a-header {
        display: flex;
        align-items: center;
        gap: var(--space-2);
    }

    .pos {
        font-weight: var(--font-weight-extrabold);
        color: var(--color-primary);
    }

    .badge {
        display: flex;
        align-items: center;
        gap: var(--space-1);
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-bold);
        padding: var(--space-1) var(--space-2);
        border-radius: var(--radius-full);
    }

    .badge-ok {
        background: var(--color-success-light);
        color: var(--color-success-dark);
    }

    .badge-err {
        background: var(--color-danger-light);
        color: var(--color-danger-dark);
    }

    .kw-tag {
        background: var(--color-warning-light);
        color: var(--color-warning-dark);
        padding: var(--space-1) var(--space-2);
        border-radius: var(--radius-sm);
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-bold);
        letter-spacing: var(--letter-spacing-wide);
    }

    .s1 {
        color: var(--color-text-muted);
        font-style: italic;
        font-size: var(--font-size-sm);
        line-height: var(--line-height-snug);
    }

    .s2 {
        font-size: var(--font-size-base);
        line-height: var(--line-height-loose);
        color: var(--color-text);
    }

    .filled-answer {
        display: inline;
        padding: var(--space-1) var(--space-2);
        border-radius: var(--radius-sm);
        font-weight: var(--font-weight-semibold);
    }

    .answer-correct {
        background: var(--color-success-light);
        color: var(--color-success-dark);
    }

    .answer-wrong {
        background: var(--color-danger-light);
        color: var(--color-danger-dark);
    }

    .correction {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        font-size: var(--font-size-sm);
        padding: var(--space-2) var(--space-3);
        background: var(--color-neutral-100);
        border-radius: var(--radius-md);
    }

    .corr-label {
        color: var(--color-text-muted);
        font-weight: var(--font-weight-semibold);
        white-space: nowrap;
    }

    .corr-value {
        color: var(--color-success-dark);
        font-weight: var(--font-weight-bold);
    }

    /* ── Back button ──────────────────────────────────────────────────── */
    .back-btn {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        align-self: flex-start;
        padding: var(--space-2) var(--space-5);
    }
</style>