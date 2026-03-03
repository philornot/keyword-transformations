<script lang="ts">
    /**
     * @fileoverview /edit/[slug] — unified set editor for admins and regular users.
     *
     * Admin session:  Saves in-place (same slug, same link).
     * No session:     Saves as a new fork. If content is unchanged the server
     *                 returns the original slug and we redirect there without
     *                 creating a duplicate.
     *
     * Svelte 5 note: any read of a `$props()` value inside `$state(...)` triggers
     * the "state_referenced_locally" warning because Svelte tracks that `data` is
     * a reactive prop. The fix is to derive the seed values with `$derived` so
     * Svelte knows the dependency is intentional, and then snapshot them into
     * plain `$state` for the mutable editor fields.
     */

    import {goto} from '$app/navigation';
    import {t} from '$lib/i18n.svelte.js';
    import KwtQuestionEditor from '$lib/components/KwtQuestionEditor.svelte';
    import type {KWTQuestion, ParsedKWTQuestion} from '$lib/types.js';
    import type {PageData} from './$types.js';
    import {CircleNotch, FloppyDisk, Plus, RocketLaunch} from 'phosphor-svelte';

    interface DraftQuestion extends ParsedKWTQuestion {
        _key: number;
    }

    const GAP = '______';

    let {data} = $props<{ data: PageData }>();

    // $derived reads are tracked by Svelte and silence the warning.
    // We snapshot them immediately into $state for the mutable editor fields.
    const isAdmin = $derived(data.isAdmin);
    const serverSlug = $derived(data.set.slug);
    const serverTitle = $derived(data.set.title);
    const serverSourceLabel = $derived(data.set.sourceLabel ?? '');
    const serverQuestions = $derived(data.set.questions as KWTQuestion[]);

    let nextKey = 0;
    let title = $state(data.set.title);
    let sourceLabel = $state(data.set.sourceLabel ?? '');
    let questions = $state<DraftQuestion[]>(
        (data.set.questions as KWTQuestion[]).map((q: KWTQuestion) => ({
            _key: nextKey++,
            sentence1: q.sentence1,
            sentence2WithGap: q.sentence2WithGap,
            keyword: q.keyword,
            correctAnswer: q.correctAnswer,
            // Spread into new arrays so mutations don't affect the source object.
            alternativeAnswers: [...q.alternativeAnswers],
            exampleWrongAnswers: [...q.exampleWrongAnswers],
            maxWords: q.maxWords,
        })),
    );

    let isSaving = $state(false);
    let errorMessage = $state('');
    let submitAttempted = $state(false);
    let touchedKeys = $state(new Set<number>());

    /** Creates a blank KWT exercise and appends it to the list. */
    function addQuestion() {
        questions.push({
            _key: nextKey++,
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
     * Marks a question as touched so its inline error becomes visible.
     *
     * @param key - The `_key` of the draft question to mark.
     */
    function touch(key: number) {
        touchedKeys = new Set(touchedKeys).add(key);
    }

    /**
     * Returns a validation error for a question, or null if valid.
     *
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

    /**
     * Returns the visible error for a question — only after the question has
     * been touched or a save was attempted.
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

    /**
     * Saves the edited set and redirects to the resulting slug.
     *
     * Admin path: PUT /api/sets/[slug] → in-place update, same slug returned.
     * User path:  PUT /api/sets/[slug] → new slug if changed, original if not.
     */
    async function save() {
        submitAttempted = true;
        if (!isValid) return;

        isSaving = true;
        errorMessage = '';

        try {
            const res = await fetch(`/api/sets/${serverSlug}`, {
                method: 'PUT',
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

            const body = await res.json();

            if (!res.ok) {
                errorMessage = body.error ?? 'Saving failed.';
                return;
            }

            goto(`/set/${body.slug}`);
        } catch (err) {
            errorMessage = err instanceof Error ? err.message : 'Unknown error.';
        } finally {
            isSaving = false;
        }
    }
</script>

<svelte:head>
    <title>
        {isAdmin ? 'Edytuj zestaw' : 'Edytuj kopię'} — {serverTitle}
    </title>
</svelte:head>

<div class="page">
    <div class="top-bar">
        <div>
            <h1>{isAdmin ? 'Edytuj zestaw' : 'Edytuj kopię zestawu'}</h1>
            <p class="subtitle">
                {#if isAdmin}
                    Zmiany nadpisują oryginalny zestaw. Link pozostaje ten sam.
                {:else}
                    Twoje zmiany zostaną zapisane jako nowy zestaw pod nowym linkiem.
                    Jeśli nic nie zmienisz, zostaniesz przekierowany do oryginału.
                {/if}
            </p>
        </div>
        <button class="btn-primary save-btn" disabled={isSaving} onclick={save}>
            {#if isSaving}
                <CircleNotch size={18} weight="bold" class="spin"/>
                Zapisywanie…
            {:else if isAdmin}
                <FloppyDisk size={18} weight="regular"/>
                Zapisz zestaw
            {:else}
                <RocketLaunch size={18} weight="regular"/>
                Zapisz kopię
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
        {#each questions as q, i (q._key)}
            <KwtQuestionEditor
                    bind:question={questions[i]}
                    index={i}
                    error={visibleError(q)}
                    onRemove={() => (questions = questions.filter((qq) => qq._key !== q._key))}
                    onTouch={() => touch(q._key)}
            />
        {/each}
    </div>

    <button class="btn-ghost add-btn" onclick={addQuestion}>
        <Plus size={16} weight="bold"/> {t('review.addQuestion')}
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
        max-width: 480px;
        line-height: var(--line-height-snug);
    }

    .save-btn {
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

    :global(.spin) {
        animation: spin 0.7s linear infinite;
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }
</style>