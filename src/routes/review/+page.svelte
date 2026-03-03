<script lang="ts">
    import {goto} from '$app/navigation';
    import {reviewState} from '$lib/store.svelte.js';
    import {t} from '$lib/i18n.svelte.js';
    import type {ParsedKWTQuestion} from '$lib/types.js';
    import KwtQuestionEditor from '$lib/components/KwtQuestionEditor.svelte';
    import {Plus, RocketLaunch} from 'phosphor-svelte';

    const GAP = '______';

    $effect(() => {
        if (reviewState.questions.length === 0) goto('/create/scan');
    });

    let title = $state(reviewState.title || '');
    let sourceLabel = $state('');
    let questions = $state<ParsedKWTQuestion[]>(
        reviewState.questions.map((q) => ({
            ...q,
            keyword: q.keyword.toUpperCase(),
            alternativeAnswers: q.alternativeAnswers ?? [],
            exampleWrongAnswers: q.exampleWrongAnswers ?? [],
        })),
    );
    let isPublishing = $state(false);
    let errorMessage = $state('');

    /** True after the user has clicked Publish at least once. */
    let submitAttempted = $state(false);

    /**
     * Set of question indices the user has interacted with (blur on any field).
     * Questions in this set show their validation error immediately.
     */
    let touchedIndices = $state(new Set<number>());

    /** Creates a blank KWT exercise and appends it to the list. */
    function addQuestion() {
        questions.push({
            sentence1: '',
            sentence2WithGap: '',
            keyword: '',
            correctAnswer: null,
            alternativeAnswers: [],
            exampleWrongAnswers: [],
            maxWords: 5,
        });
    }

    /**
     * Marks a question index as touched so its errors become visible.
     *
     * @param index - The array index of the question to mark.
     */
    function touch(index: number) {
        touchedIndices = new Set(touchedIndices).add(index);
    }

    /**
     * Returns a validation error for a question, or null if valid.
     *
     * @param q - The question to validate.
     * @returns Error message string or null.
     */
    function questionError(q: ParsedKWTQuestion): string | null {
        if (!q.sentence1.trim()) return t('review.errSentence1');
        if (!q.sentence2WithGap.includes(GAP)) return t('review.errSentence2');
        if (!q.keyword.trim()) return t('review.errKeyword');
        if (!q.correctAnswer?.trim()) return t('review.errAnswer');
        return null;
    }

    /**
     * Returns the error for a question only when the user should see it.
     * Error is shown after the question has been touched OR after a publish attempt.
     *
     * @param q - The question to check.
     * @param index - The array index of the question.
     * @returns Error message string or null.
     */
    function visibleError(q: ParsedKWTQuestion, index: number): string | null {
        if (!submitAttempted && !touchedIndices.has(index)) return null;
        return questionError(q);
    }

    const isValid = $derived(
        title.trim().length > 0 &&
        questions.length > 0 &&
        questions.every((q) => questionError(q) === null),
    );

    /** Publishes the set and redirects to the live test URL. */
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
                    questions: questions.map((q) => ({
                        sentence1: q.sentence1.trim(),
                        sentence2WithGap: q.sentence2WithGap.trim(),
                        keyword: q.keyword.trim(),
                        correctAnswer: q.correctAnswer!.trim(),
                        alternativeAnswers: q.alternativeAnswers,
                        exampleWrongAnswers: q.exampleWrongAnswers,
                        maxWords: q.maxWords,
                    })),
                }),
            });
            if (!res.ok) {
                const body = await res.json();
                errorMessage = body.error ?? 'Failed.';
                return;
            }
            const {slug} = await res.json();
            await goto(`/set/${slug}`);
        } catch (err) {
            errorMessage = err instanceof Error ? err.message : 'Unknown error.';
        } finally {
            isPublishing = false;
        }
    }
</script>

<svelte:head>
    <title>{t('review.title')} — Key word transformations</title>
</svelte:head>

<div class="review-page">
    <div class="top-bar">
        <div>
            <h1>{t('review.title')}</h1>
            <p class="subtitle">{t('review.subtitle', {n: questions.length})}</p>
        </div>
        <button class="btn-primary pub-btn" disabled={isPublishing} onclick={publish}>
            {#if isPublishing}
                <span class="spinner"></span> {t('review.publishing')}
            {:else}
                <RocketLaunch size={18} weight="regular"/> {t('review.publish')}
            {/if}
        </button>
    </div>

    <div class="meta-row">
        <div class="meta-field">
            <label class="field-label" for="set-title">{t('review.setTitle')}</label>
            <input
                    id="set-title"
                    class="text-input"
                    type="text"
                    bind:value={title}
                    placeholder={t('review.setTitlePlaceholder')}
            />
        </div>
        <div class="meta-field">
            <label class="field-label" for="source-label">{t('review.sourceLabel')}</label>
            <input
                    id="source-label"
                    class="text-input"
                    type="text"
                    bind:value={sourceLabel}
                    placeholder={t('review.sourceLabelPlaceholder')}
            />
        </div>
    </div>

    {#if errorMessage}
        <p class="error-banner" role="alert">{errorMessage}</p>
    {/if}

    <div class="questions">
        {#each questions as q, i (i)}
            <KwtQuestionEditor
                    bind:question={questions[i]}
                    index={i}
                    error={visibleError(q, i)}
                    onRemove={() => questions.splice(i, 1)}
                    onTouch={() => touch(i)}
            />
        {/each}
    </div>

    <button class="btn-ghost add-btn" onclick={addQuestion}>
        <Plus size={16} weight="bold"/> {t('review.addQuestion')}
    </button>
</div>

<style>
    .review-page {
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
</style>