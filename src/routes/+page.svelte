<script lang="ts">
    import {goto} from '$app/navigation';
    import {t} from '$lib/i18n.svelte.js';
    import KwtQuestionEditor from '$lib/components/KwtQuestionEditor.svelte';
    import type {ParsedKWTQuestion} from '$lib/types.js';
    import {CircleNotch, Plus, RocketLaunch} from 'phosphor-svelte';

    interface DraftQuestion extends ParsedKWTQuestion {
        _key: number;
    }

    const GAP = '______';
    let nextKey = 0;
    let title = $state('');
    let questions = $state<DraftQuestion[]>([]);
    let isPublishing = $state(false);
    let errorMessage = $state('');

    /** Creates a blank KWT exercise and appends it to the list. */
    function addQuestion() {
        questions.push({
            _key: nextKey++,
            sentence1: '', sentence2WithGap: '',
            keyword: '', correctAnswer: null, maxWords: 5,
        });
    }

    /**
     * Returns a validation error for a question, or null if valid.
     * @param q - The draft question to validate.
     * @returns Error message string or null.
     */
    function questionError(q: DraftQuestion): string | null {
        if (!q.sentence1.trim()) return t('review.errSentence1');
        if (!q.sentence2WithGap.includes(GAP)) return t('review.errSentence2');
        if (!q.keyword.trim()) return t('review.errKeyword');
        if (!q.correctAnswer?.trim()) return t('review.errAnswer');
        return null;
    }

    const isValid = $derived(
        title.trim().length > 0 &&
        questions.length > 0 &&
        questions.every((q) => questionError(q) === null)
    );

    /** Publishes the set and redirects to the live URL. */
    async function publish() {
        if (!isValid) return;
        isPublishing = true;
        errorMessage = '';
        try {
            const res = await fetch('/api/sets', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    title: title.trim(),
                    questions: questions.map((q) => ({
                        sentence1: q.sentence1.trim(),
                        sentence2WithGap: q.sentence2WithGap.trim(),
                        keyword: q.keyword.trim(),
                        correctAnswer: q.correctAnswer!.trim(),
                        maxWords: q.maxWords,
                    })),
                }),
            });
            if (!res.ok) {
                const {error} = await res.json();
                throw new Error(error ?? 'Failed.');
            }
            const {slug} = await res.json();
            goto(`/set/${slug}`);
        } catch (err) {
            errorMessage = err instanceof Error ? err.message : 'Unknown error.';
        } finally {
            isPublishing = false;
        }
    }
</script>

<svelte:head><title>{t('manual.title')} — WorksheetApp</title></svelte:head>

<div class="page">
    <div class="top-bar">
        <div>
            <h1>{t('manual.title')}</h1>
            <p class="subtitle">{t('manual.subtitle')}</p>
        </div>
        <button class="btn-primary pub-btn" disabled={!isValid || isPublishing} onclick={publish}>
            {#if isPublishing}
                <CircleNotch size={18} weight="bold" class="spin"/> {t('manual.publishing')}
            {:else}
                <RocketLaunch size={18} weight="regular"/> {t('manual.publish')}
            {/if}
        </button>
    </div>

    <div class="title-row">
        <label class="field-label" for="set-title">{t('manual.setTitle')}</label>
        <input
                id="set-title"
                class="text-input"
                type="text"
                bind:value={title}
                placeholder={t('manual.setTitlePlaceholder')}
        />
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
                        error={questionError(q)}
                        onRemove={() => questions.splice(i, 1)}
                />
            {/each}
        </div>
    {/if}

    <button class="btn-ghost add-btn" onclick={addQuestion}>
        <Plus size={16} weight="bold"/> {t('manual.addQuestion')}
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

    .title-row {
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