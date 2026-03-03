<script lang="ts">
    /**
     * @fileoverview Reusable KWT question card editor.
     * Used by both /review (post-OCR) and /create/manual.
     */

    import {t} from '$lib/i18n.svelte.js';
    import type {ParsedKWTQuestion} from '$lib/types.js';
    import {PlusIcon, WarningCircleIcon, XSquare} from 'phosphor-svelte';
    import {CANONICAL_GAP} from '$lib/constants.js';

    interface Props {
        question: ParsedKWTQuestion;
        index: number;
        onRemove: () => void;
        error: string | null;
        onTouch?: () => void;
    }

    let {question = $bindable(), index, error, onRemove, onTouch}: Props = $props();

    const GAP = '______';

    let newAltAnswer = $state('');
    let newWrongAnswer = $state('');

    /**
     * Uppercases and strips non-alpha characters from keyword input.
     *
     * @param e - Native input event.
     */
    function onKeywordInput(e: Event) {
        const raw = (e.currentTarget as HTMLInputElement).value;
        question.keyword = raw.toUpperCase().replace(/[^A-Z]/g, '');
    }

    /**
     * Normalises the sentence2 textarea value on every keystroke:
     *  - Any run of one or more underscores is replaced with the canonical
     *    six-underscore gap marker `______`.
     *  - Cursor position is preserved so typing feels natural.
     *
     * @param e - Native input event from the sentence2 textarea.
     */
    function onGapInput(e: Event) {
        const el = e.currentTarget as HTMLTextAreaElement;
        const raw = el.value;
        const cursorBefore = raw.slice(0, el.selectionStart ?? 0);

        const normalised = raw.replace(/_+/g, (match) => {
            if (match.length < 6) return match.length === 1 ? CANONICAL_GAP : '';
            return CANONICAL_GAP;
        });

        if (normalised === raw) {
            question.sentence2WithGap = raw;
            return;
        }

        question.sentence2WithGap = normalised;

        const normBefore = cursorBefore.replace(/_+/g, (match) => {
            if (match.length < 6) return match.length === 1 ? CANONICAL_GAP : '';
            return CANONICAL_GAP;
        });

        requestAnimationFrame(() => {
            el.selectionStart = el.selectionEnd = normBefore.length;
        });
    }

    /**
     * Inserts the canonical gap placeholder at the cursor position in sentence2.
     *
     * @param el - The textarea DOM element.
     */
    function insertGap(el: HTMLTextAreaElement) {
        const s = el.selectionStart ?? el.value.length;
        const e = el.selectionEnd ?? el.value.length;
        question.sentence2WithGap = el.value.slice(0, s) + GAP + el.value.slice(e);
        requestAnimationFrame(() => {
            el.focus();
            el.selectionStart = el.selectionEnd = s + GAP.length;
        });
    }

    /** Retrieves the sentence2 textarea by index and delegates to {@link insertGap}. */
    function handleInsertGap() {
        const el = document.getElementById(`s2-${index}`);
        if (el instanceof HTMLTextAreaElement) insertGap(el);
    }

    /** Appends a trimmed non-empty string to the alternative answers list. */
    function addAltAnswer() {
        const val = newAltAnswer.trim();
        if (val) {
            question.alternativeAnswers.push(val);
            newAltAnswer = '';
        }
    }

    /** Appends a trimmed non-empty string to the wrong answers list. */
    function addWrongAnswer() {
        const val = newWrongAnswer.trim();
        if (val) {
            question.exampleWrongAnswers.push(val);
            newWrongAnswer = '';
        }
    }

    /**
     * Handles Enter key in the "add answer" inputs.
     *
     * @param e - Keyboard event.
     * @param handler - The add function to call on Enter.
     */
    function onAnswerKeydown(e: KeyboardEvent, handler: () => void) {
        if (e.key === 'Enter') {
            e.preventDefault();
            handler();
        }
    }

    // ── Word range ──────────────────────────────────────────────────────

    /**
     * Formats minWords / maxWords into the single-field display string.
     *
     * Conventions used by this component:
     *   0 / 0  → ''     (no limit)
     *   0 / 5  → '5'    (max only)
     *   2 / 5  → '2–5'  (explicit range)
     *   n / n  → 'n'    (min === max → single number)
     *
     * @param min - Minimum word count; 0 means no minimum.
     * @param max - Maximum word count; 0 means no maximum.
     * @returns Human-readable string for the text input.
     */
    function formatWordRange(min: number, max: number): string {
        if (!max) return '';
        if (!min || min <= 1 || min === max) return String(max);
        return `${min}–${max}`;
    }

    /**
     * Parses the word-range text field and writes the result back to the
     * question object. Accepted formats:
     *   ''       → minWords = 0, maxWords = 0  (no limit)
     *   '5'      → minWords = 0, maxWords = 5  (max only)
     *   '2-5'    → minWords = 2, maxWords = 5
     *   '2–5'    → same (en-dash variant)
     *
     * Invalid or out-of-range input is silently ignored — the previous
     * values are kept and the display is normalised on blur.
     *
     * @param raw - Raw string value from the input element.
     */
    function applyWordRange(raw: string): void {
        const val = raw.trim();

        if (!val) {
            question.minWords = 0;
            question.maxWords = 0;
            return;
        }

        const rangeMatch = val.match(/^(\d+)\s*[-–]\s*(\d+)$/);
        if (rangeMatch) {
            const lo = parseInt(rangeMatch[1], 10);
            const hi = parseInt(rangeMatch[2], 10);
            if (lo > 0 && hi > 0 && lo <= hi && hi <= 20) {
                question.minWords = lo;
                question.maxWords = hi;
            }
            return;
        }

        const single = parseInt(val, 10);
        if (!isNaN(single) && single > 0 && single <= 20) {
            question.minWords = 0;
            question.maxWords = single;
        }
    }

    /** Local display value; kept in sync with the question object. */
    let wordRangeValue = $state(formatWordRange(question.minWords, question.maxWords));

    /**
     * Updates the question object on every keystroke.
     *
     * @param e - Native input event.
     */
    function onWordRangeInput(e: Event): void {
        wordRangeValue = (e.currentTarget as HTMLInputElement).value;
        applyWordRange(wordRangeValue);
    }

    /**
     * Normalises the displayed string on blur (e.g. "2-5" → "2–5")
     * and fires the touch callback.
     */
    function onWordRangeBlur(): void {
        wordRangeValue = formatWordRange(question.minWords, question.maxWords);
        onTouch?.();
    }
</script>

<div class="q-card card" class:has-error={error !== null}>
    <div class="q-header">
        <span class="q-num">{t('review.questionNum', {n: index + 1})}</span>
        {#if error}
      <span class="q-err">
        <WarningCircleIcon size={13} weight="bold"/> {error}
      </span>
        {/if}
        <button
                class="btn-danger rm-btn"
                onclick={onRemove}
                aria-label="{t('common.remove')} #{index + 1}"
        >
            <XSquare size={15} weight="bold"/>
        </button>
    </div>

    <!-- Sentence 1 -->
    <label class="field-label" for="s1-{index}">{t('review.sentence1')}</label>
    <textarea
            id="s1-{index}"
            class="text-input"
            rows="2"
            bind:value={question.sentence1}
            placeholder={t('review.sentence1ph')}
            onblur={() => onTouch?.()}
    ></textarea>

    <!-- Keyword -->
    <label class="field-label" for="kw-{index}">{t('review.keyword')}</label>
    <input
            id="kw-{index}"
            class="text-input kw-input"
            type="text"
            value={question.keyword}
            oninput={onKeywordInput}
            placeholder={t('review.keywordph')}
            onblur={() => onTouch?.()}
    />

    <!-- Sentence 2 -->
    <label class="field-label" for="s2-{index}">
        {t('review.sentence2')}
        <span class="gap-hint">— wpisz <code>_</code> żeby wstawić lukę</span>
    </label>
    <div class="s2-wrap">
    <textarea
            id="s2-{index}"
            class="text-input gap-textarea"
            rows="2"
            value={question.sentence2WithGap}
            oninput={onGapInput}
            placeholder={t('review.sentence2ph')}
            onblur={() => onTouch?.()}
    ></textarea>
        <button
                type="button"
                class="btn-ghost insert-gap-btn"
                class:hidden={question.sentence2WithGap.includes(CANONICAL_GAP)}
                onclick={handleInsertGap}
                title="Wstaw ______ w miejscu kursora"
        >+ ______
        </button>
    </div>

    <!-- Primary answer + word range -->
    <div class="bottom-row">
        <div class="answer-field">
            <label class="field-label" for="ans-{index}">{t('review.answer')}</label>
            <input
                    id="ans-{index}"
                    class="text-input"
                    type="text"
                    bind:value={question.correctAnswer}
                    placeholder={t('review.answerph')}
                    onblur={() => onTouch?.()}
            />
        </div>

        <!-- Word range: single text input -->
        <div class="word-range-field">
            <label class="field-label" for="wr-{index}">{t('review.wordRange')}</label>
            <input
                    id="wr-{index}"
                    class="text-input word-range-input"
                    type="text"
                    value={wordRangeValue}
                    oninput={onWordRangeInput}
                    onblur={onWordRangeBlur}
                    placeholder="np. 2–5 lub 5"
                    title="Wpisz zakres (np. 2–5), samą max. liczbę (np. 5) lub zostaw puste — bez limitu"
            />
            <span class="range-hint">puste = bez limitu</span>
        </div>
    </div>

    <!-- Alternative correct answers -->
    <div class="answers-block">
        <span class="field-label">{t('review.alternativeAnswers')}</span>
        {#if question.alternativeAnswers.length > 0}
            <div class="chip-list">
                {#each question.alternativeAnswers as ans, i}
          <span class="chip chip-ok">
            {ans}
              <button
                      class="chip-rm"
                      type="button"
                      aria-label="{t('common.remove')} {ans}"
                      onclick={() => question.alternativeAnswers.splice(i, 1)}
              ><XSquare size={11} weight="bold"/></button>
          </span>
                {/each}
            </div>
        {/if}
        <div class="add-answer-row">
            <input
                    class="text-input add-input"
                    type="text"
                    bind:value={newAltAnswer}
                    placeholder={t('review.altAnswerPh')}
                    onkeydown={(e) => onAnswerKeydown(e, addAltAnswer)}
                    onblur={() => onTouch?.()}
            />
            <button type="button" class="btn-ghost add-chip-btn" onclick={addAltAnswer}>
                <PlusIcon size={13} weight="bold"/> {t('review.addAnswerBtn')}
            </button>
        </div>
    </div>

    <!-- Example wrong answers -->
    <div class="answers-block">
        <span class="field-label">{t('review.exampleWrongAnswers')}</span>
        {#if question.exampleWrongAnswers.length > 0}
            <div class="chip-list">
                {#each question.exampleWrongAnswers as ans, i}
          <span class="chip chip-err">
            {ans}
              <button
                      class="chip-rm"
                      type="button"
                      aria-label="{t('common.remove')} {ans}"
                      onclick={() => question.exampleWrongAnswers.splice(i, 1)}
              ><XSquare size={11} weight="bold"/></button>
          </span>
                {/each}
            </div>
        {/if}
        <div class="add-answer-row">
            <input
                    class="text-input add-input"
                    type="text"
                    bind:value={newWrongAnswer}
                    placeholder={t('review.wrongAnswerPh')}
                    onkeydown={(e) => onAnswerKeydown(e, addWrongAnswer)}
                    onblur={() => onTouch?.()}
            />
            <button type="button" class="btn-ghost add-chip-btn" onclick={addWrongAnswer}>
                <PlusIcon size={13} weight="bold"/> {t('review.addAnswerBtn')}
            </button>
        </div>
    </div>
</div>

<style>
    .q-card {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
        border: 2px solid transparent;
        transition: border-color var(--transition-base);
    }

    .q-card.has-error {
        border-color: var(--color-warning);
    }

    .q-header {
        display: flex;
        align-items: center;
        gap: var(--space-3);
    }

    .q-num {
        font-weight: var(--font-weight-bold);
        color: var(--color-primary);
        font-size: var(--font-size-sm);
    }

    .q-err {
        flex: 1;
        display: flex;
        align-items: center;
        gap: var(--space-1);
        color: var(--color-warning);
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-bold);
    }

    .rm-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: var(--space-1) var(--space-2);
        font-size: var(--font-size-xs);
        margin-left: auto;
    }

    .kw-input {
        font-weight: var(--font-weight-bold);
        letter-spacing: var(--letter-spacing-wide);
        max-width: 200px;
        resize: none;
    }

    .gap-hint {
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-normal);
        color: var(--color-text-muted);
        text-transform: none;
        letter-spacing: 0;
        margin-left: var(--space-2);
    }

    .gap-hint code {
        font-family: var(--font-mono), monospace;
        background: var(--color-neutral-200);
        padding: 0 3px;
        border-radius: 3px;
    }

    .gap-textarea {
        font-family: var(--font-mono), monospace;
        letter-spacing: -0.03em;
    }

    .s2-wrap {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
    }

    .insert-gap-btn {
        align-self: flex-start;
        padding: var(--space-1) var(--space-3);
        font-size: var(--font-size-xs);
        font-family: var(--font-mono), monospace;
        font-weight: var(--font-weight-bold);
    }

    .bottom-row {
        display: flex;
        gap: var(--space-4);
        align-items: flex-end;
        flex-wrap: wrap;
    }

    .answer-field {
        flex: 1;
        min-width: 200px;
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
    }

    /* ── Word range single input ──────────────────────────────────────── */
    .word-range-field {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        flex-shrink: 0;
    }

    .word-range-input {
        width: 96px;
        text-align: center;
    }

    .range-hint {
        font-size: var(--font-size-xs);
        color: var(--color-text-muted);
        text-align: center;
    }

    /* ── Answer chip lists ────────────────────────────────────────────── */
    .answers-block {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        padding: var(--space-3);
        background: var(--color-neutral-100);
        border-radius: var(--radius-md);
    }

    .chip-list {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2);
    }

    .chip {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        padding: var(--space-1) var(--space-2);
        border-radius: var(--radius-full);
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-semibold);
    }

    .chip-ok {
        background: var(--color-success-light);
        color: var(--color-success-dark);
    }

    .chip-err {
        background: var(--color-danger-light);
        color: var(--color-danger-dark);
    }

    .chip-rm {
        background: none;
        border: none;
        padding: 0;
        cursor: pointer;
        display: flex;
        align-items: center;
        color: inherit;
        opacity: 0.7;
        border-radius: 0;
    }

    .chip-rm:hover {
        opacity: 1;
    }

    .chip-rm:active {
        transform: none;
    }

    .add-answer-row {
        display: flex;
        gap: var(--space-2);
        align-items: center;
    }

    .add-input {
        flex: 1;
        font-size: var(--font-size-sm);
        padding: var(--space-1) var(--space-2);
    }

    .add-chip-btn {
        display: flex;
        align-items: center;
        gap: var(--space-1);
        padding: var(--space-1) var(--space-3);
        font-size: var(--font-size-xs);
        white-space: nowrap;
        flex-shrink: 0;
    }

    .insert-gap-btn.hidden {
        visibility: hidden;
        pointer-events: none;
    }
</style>