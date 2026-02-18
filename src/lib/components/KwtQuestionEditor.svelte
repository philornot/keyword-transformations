<script lang="ts">
    /**
     * @fileoverview Reusable KWT question card editor.
     * Used by both /review (post-OCR) and /create/manual.
     * The parent owns the question data; this component mutates it directly
     * via a $bindable prop.
     */

    import {t} from '$lib/i18n.svelte.js';
    import type {ParsedKWTQuestion} from '$lib/types.js';
    import {WarningCircle, XSquare} from 'phosphor-svelte';

    interface Props {
        question: ParsedKWTQuestion;
        index: number;
        onRemove: () => void;
        error: string | null;
    }

    let {question = $bindable(), index, onRemove, error}: Props = $props();

    const GAP = '______';

    /**
     * Uppercases and strips non-alpha characters from keyword input.
     * Accepts the raw Event so no `as` cast is needed in the template.
     * @param e - Native input event.
     */
    function onKeywordInput(e: Event) {
        const raw = (e.currentTarget as HTMLInputElement).value;
        question.keyword = raw.toUpperCase().replace(/[^A-Z]/g, '');
    }

    /**
     * Inserts the canonical gap placeholder at the cursor position in sentence2.
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

    /**
     * Retrieves the sentence2 textarea by index and delegates to insertGap.
     * Avoids TypeScript `as` casts inside Svelte template expressions.
     */
    function handleInsertGap() {
        const el = document.getElementById(`s2-${index}`);
        if (el instanceof HTMLTextAreaElement) insertGap(el);
    }
</script>

<div class="q-card card" class:has-error={error !== null}>
    <div class="q-header">
        <span class="q-num">{t('review.questionNum', {n: index + 1})}</span>
        {#if error}
      <span class="q-err">
        <WarningCircle size={13} weight="bold"/> {error}
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

    <label class="field-label" for="s1-{index}">{t('review.sentence1')}</label>
    <textarea
            id="s1-{index}"
            class="text-input"
            rows="2"
            bind:value={question.sentence1}
            placeholder={t('review.sentence1ph')}
    ></textarea>

    <label class="field-label" for="kw-{index}">{t('review.keyword')}</label>
    <input
            id="kw-{index}"
            class="text-input kw-input"
            type="text"
            value={question.keyword}
            oninput={onKeywordInput}
            placeholder={t('review.keywordph')}
    />

    <label class="field-label" for="s2-{index}">{t('review.sentence2')}</label>
    <div class="s2-wrap">
    <textarea
            id="s2-{index}"
            class="text-input"
            rows="2"
            bind:value={question.sentence2WithGap}
            placeholder={t('review.sentence2ph')}
    ></textarea>
        <button
                type="button"
                class="btn-ghost insert-gap-btn"
                onclick={handleInsertGap}
                title="Wstaw ______ w miejscu kursora"
        >+ ______
        </button>
    </div>

    <div class="bottom-row">
        <div class="answer-field">
            <label class="field-label" for="ans-{index}">{t('review.answer')}</label>
            <input
                    id="ans-{index}"
                    class="text-input"
                    type="text"
                    bind:value={question.correctAnswer}
                    placeholder={t('review.answerph')}
            />
        </div>
        <div class="mw-field">
            <label class="field-label" for="mw-{index}">{t('review.maxWords')}</label>
            <select id="mw-{index}" class="text-input" bind:value={question.maxWords}>
                <option value={3}>{t('common.words3')}</option>
                <option value={4}>{t('common.words4')}</option>
                <option value={5}>{t('common.words5')}</option>
            </select>
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

    .mw-field {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
    }

    .mw-field select {
        width: 120px;
        cursor: pointer;
    }
</style>