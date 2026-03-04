<script lang="ts">
    /**
     * /create/manual — manual exercise-set editor.
     *
     * Reads the exercise type from the global `mode` store — the same store
     * the nav tabs write to. Switching tabs while on this page instantly
     * updates the type badge and validation rules without any navigation.
     */

    import {goto} from '$app/navigation';
    import {t} from '$lib/i18n.svelte.js';
    import {mode} from '$lib/mode.svelte.js';
    import KwtQuestionEditor from '$lib/components/KwtQuestionEditor.svelte';
    import type {ParsedKWTQuestion} from '$lib/types.js';
    import {CircleNotchIcon, PlusIcon, RocketLaunchIcon} from 'phosphor-svelte';

    interface DraftQuestion extends ParsedKWTQuestion {
        _key: number;
    }

    const GAP = '______';

    let nextKey = 0;
    let title = $state('');
    let sourceLabel = $state('');
    let questions = $state<DraftQuestion[]>([]);
    let isPublishing = $state(false);
    let errorMessage = $state('');

    /** True after the user has clicked "Publish" at least once. */
    let submitAttempted = $state(false);

    /**
     * Set of question `_key` values the user has interacted with.
     * Questions in this set show their validation errors immediately.
     */
    let touchedKeys = $state(new Set<number>());

    /** Creates a blank exercise and appends it to the list. */
    function addQuestion() {
        questions.push({
            _key: nextKey++,
            sentence1: '',
            sentence2WithGap: '',
            keyword: '',
            correctAnswer: null,
            alternativeAnswers: [],
            exampleWrongAnswers: [],
            minWords: 0,
            maxWords: 0,
        });
    }

    /**
     * Marks a question as touched so its errors become visible.
     *
     * @param key - The `_key` of the draft question to mark.
     */
    function touch(key: number) {
        touchedKeys.add(key);
        touchedKeys = touchedKeys;
    }

    /**
     * Returns a validation error for a question, or null if valid.
     * sentence1 and keyword are only required for 'kwt' mode.
     *
     * @param q - The draft question to validate.
     * @returns Error message string or null.
     */
    function questionError(q: DraftQuestion): string | null {
        if (mode.type === 'kwt' && !q.sentence1.trim()) return t('review.errSentence1');
        if (!q.sentence2WithGap.includes(GAP)) return t('review.errSentence2');
        if (mode.type === 'kwt' && !q.keyword.trim()) return t('review.errKeyword');
        if (!q.correctAnswer?.trim()) return t('review.errAnswer');
        return null;
    }

    /**
     * Returns the error for a question only when the user should see it.
     *
     * @param q - The draft question.
     * @returns Error message string or null.
     */
    function visibleError(q: DraftQuestion): string | null {
        if (!submitAttempted && !touchedKeys.has(q._key)) return null;
        return questionError(q);
    }

    const isValid = $derived(
        title.trim().length > 0 &&
        questions.length > 0 &&
        questions.every((q) => questionError(q) === null),
    );

    /** Publishes the set and redirects to the live URL. */
    async function publish() {
        submitAttempted = true;
        if (!isValid) return;

        isPublishing = true;
        errorMessage = '';
        try {
            const res = await fetch('/api/sets', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    title: title.trim(),
                    sourceLabel: sourceLabel.trim() || undefined,
                    type: mode.type,
                    questions: questions.map((q) => ({
                        sentence1: q.sentence1.trim(),
                        sentence2WithGap: q.sentence2WithGap.trim(),
                        keyword: q.keyword.trim(),
                        correctAnswer: q.correctAnswer!.trim(),
                        alternativeAnswers: q.alternativeAnswers,
                        exampleWrongAnswers: q.exampleWrongAnswers,
                        minWords: q.minWords,
                        maxWords: q.maxWords,
                    })),
                }),
            });

            const body = await res.json();
            if (!res.ok) {
                errorMessage = body.error ?? 'Failed.';
                return;
            }
            await goto(`/set/${body.slug}`);
        } catch (err) {
            errorMessage = err instanceof Error ? err.message : 'Unknown error.';
        } finally {
            isPublishing = false;
        }
    }

    const typeLabels: Record<string, string> = {
        kwt: 'KWT',
        grammar: 'Gramatykalizacja',
        translation: 'Tłumaczenia',
    };
</script>

<svelte:head>
    <title>{t('manual.title')} — {typeLabels[mode.type]} — Key word transformations</title>
</svelte:head>

<div class="page">
    <div class="top-bar">
        <div>
            <h1>
                {t('manual.title')}
                <span class="type-label">{typeLabels[mode.type]}</span>
            </h1>
            <p class="subtitle">{t('manual.subtitle')}</p>
        </div>
        <button class="btn-primary pub-btn" disabled={isPublishing} onclick={publish}>
            {#if isPublishing}
                <CircleNotchIcon size={18} weight="bold" class="spin"/> {t('manual.publishing')}
            {:else}
                <RocketLaunchIcon size={18} weight="regular"/> {t('manual.publish')}
            {/if}
        </button>
    </div>

    <div class="meta-row">
        <div class="meta-field">
            <label class="field-label" for="set-title">{t('manual.setTitle')}</label>
            <input
                    id="set-title"
                    class="text-input"
                    type="text"
                    bind:value={title}
                    placeholder={t('manual.setTitlePlaceholder')}
            />
        </div>
        <div class="meta-field">
            <label class="field-label" for="source-label">{t('manual.sourceLabel')}</label>
            <input
                    id="source-label"
                    class="text-input"
                    type="text"
                    bind:value={sourceLabel}
                    placeholder={t('manual.sourceLabelPlaceholder')}
            />
        </div>
    </div>

    {#if errorMessage}
        <p class="error-banner" role="alert">{errorMessage}</p>
    {/if}

    {#if questions.length === 0}
        <div class="empty-state card">{t('manual.empty')}</div>
    {:else}
        <div class="questions">
            {#each questions as q, i (q._key)}
                <KwtQuestionEditor
                        bind:question={questions[i]}
                        index={i}
                        setType={mode.type}
                        error={visibleError(q)}
                        onRemove={() => questions = questions.filter((qq) => qq._key !== q._key)}
                        onTouch={() => touch(q._key)}
                />
            {/each}
        </div>
    {/if}

    <button class="btn-ghost add-btn" onclick={addQuestion}>
        <PlusIcon size={16} weight="bold"/> {t('manual.addQuestion')}
    </button>
</div>

<style>
    .page {
        display: flex;
        flex-direction: column;
        gap: var(--space-5);
    }

    .top-bar {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: var(--space-4);
    }

    h1 {
        font-size: var(--font-size-3xl);
        font-weight: var(--font-weight-extrabold);
        display: flex;
        align-items: center;
        gap: var(--space-3);
        flex-wrap: wrap;
    }

    .type-label {
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-semibold);
        background: var(--color-primary);
        color: var(--color-surface);
        padding: var(--space-1) var(--space-3);
        border-radius: var(--radius-full);
    }

    .subtitle {
        color: var(--color-text-faint);
        font-size: var(--font-size-sm);
        margin-top: var(--space-1);
    }

    .pub-btn {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-3) var(--space-6);
        font-weight: var(--font-weight-semibold);
        flex-shrink: 0;
    }

    .meta-row {
        display: flex;
        gap: var(--space-4);
        flex-wrap: wrap;
    }

    .meta-field {
        flex: 1;
        min-width: 220px;
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
    }

    .empty-state {
        text-align: center;
        color: var(--color-text-faint);
        padding: var(--space-8);
    }

    .questions {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
    }

    .add-btn {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        align-self: flex-start;
        padding: var(--space-2) var(--space-5);
    }

    :global(.spin) {
        animation: spin 0.7s linear infinite;
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }
</style>