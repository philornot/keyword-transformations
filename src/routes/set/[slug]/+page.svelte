<script lang="ts">
  /**
   * /set/[slug] — interactive KWT test page.
   *
   * Each question shows:
   *  - The original sentence
   *  - The keyword in bold caps
   *  - The gapped sentence with an inline text input where the gap is
   *
   * Correct answers are never sent to the browser.
   */

  import type { PageData } from './$types.js';
  import type { PublicKWTQuestion } from '$lib/types.js';
  import { goto } from '$app/navigation';
  import { t } from '$lib/i18n.svelte.js';
  import { CheckFat } from 'phosphor-svelte';

  let { data } = $props<{ data: PageData }>();

  const GAP = '______';

  /** Maps question id → typed answer string. */
  let answers      = $state<Record<number, string>>({});
  let isSubmitting = $state(false);
  let errorMessage = $state('');

  const unanswered = $derived(
    data.set.questions.filter((q: PublicKWTQuestion) => !answers[q.id]?.trim()).length
  );

  /**
   * Splits a sentence on the gap placeholder, returning at most two parts.
   * @param s - Sentence string containing `______`.
   * @returns [before, after] tuple.
   */
  function splitGap(s: string): [string, string] {
    const idx = s.indexOf(GAP);
    if (idx === -1) return [s, ''];
    return [s.slice(0, idx), s.slice(idx + GAP.length)];
  }

  /** Submits all answers and redirects to the result page. */
  async function submit() {
    isSubmitting = true;
    errorMessage = '';
    try {
      const res = await fetch(`/api/sets/${data.set.slug}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: data.set.questions.map((q: PublicKWTQuestion) => ({
            questionId: q.id,
            given: answers[q.id]?.trim() ?? '',
          })),
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        errorMessage = body.error ?? 'Submission failed.';
        return;
      }
      const { attemptSlug } = await res.json();
      goto(`/result/${attemptSlug}`);
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : 'Unknown error.';
    } finally {
      isSubmitting = false;
    }
  }
</script>

<svelte:head><title>{data.set.title} — WorksheetApp</title></svelte:head>

<div class="set-page">
  <div class="set-header">
    <h1>{data.set.title}</h1>
    <p class="q-count">{t('set.questions', { n: data.set.questions.length })}</p>
    {#if data.set.questions[0]}
      <p class="instructions">
        {t('set.maxWords', { n: data.set.questions[0].maxWords })} — {t('set.keyword')} wymagany w odpowiedzi.
      </p>
    {/if}
  </div>

  <form onsubmit={async (e) => { e.preventDefault(); await submit(); }}>
    <div class="questions">
      {#each data.set.questions as q (q.id)}
        {@const [before, after] = splitGap(q.sentence2WithGap)}
        {@const filled = !!answers[q.id]?.trim()}

        <div class="q-card card" class:filled>
          <div class="q-meta">
            <span class="q-pos">{q.position}.</span>
            <span class="keyword">{t('set.keyword')} <strong>{q.keyword}</strong></span>
            <span class="max-words">{t('set.maxWords', { n: q.maxWords })}</span>
          </div>

          <p class="sentence1">{q.sentence1}</p>

          <div class="sentence2-wrap">
            <span class="s2-label">{t('set.sentence2label')}</span>
            <span class="sentence2">
              {before}<input
                type="text"
                class="gap-input"
                aria-label="Answer for question {q.position}"
                placeholder={t('set.gapPlaceholder')}
                bind:value={answers[q.id]}
              />{after}
            </span>
          </div>
        </div>
      {/each}
    </div>

    {#if errorMessage}
      <p class="error-banner" role="alert">{errorMessage}</p>
    {/if}

    <div class="submit-bar">
      {#if unanswered > 0}
        <p class="hint">{t('set.unanswered', { n: unanswered })}</p>
      {/if}
      <button type="submit" class="btn-primary submit-btn" disabled={isSubmitting}>
        {#if isSubmitting}
          <span class="spinner"></span> {t('set.submitting')}
        {:else}
          <CheckFat size={18} weight="regular" /> {t('set.submit')}
        {/if}
      </button>
    </div>
  </form>
</div>

<style>
  .set-page { display: flex; flex-direction: column; gap: var(--space-6); }

  .set-header {
    border-bottom:  2px solid var(--color-border-subtle);
    padding-bottom: var(--space-4);
  }
  h1           { font-size: var(--font-size-3xl); font-weight: var(--font-weight-extrabold); }
  .q-count     { color: var(--color-text-muted); margin-top: var(--space-1); }
  .instructions { color: var(--color-primary); font-size: var(--font-size-sm); margin-top: var(--space-2); font-weight: var(--font-weight-medium); }

  .questions { display: flex; flex-direction: column; gap: var(--space-4); }

  .q-card {
    border:         2px solid transparent;
    transition:     border-color var(--transition-base);
    display:        flex;
    flex-direction: column;
    gap:            var(--space-3);
  }
  .q-card.filled { border-color: #c3fae8; }

  .q-meta    { display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap; }
  .q-pos     { font-weight: var(--font-weight-extrabold); color: var(--color-primary); font-size: var(--font-size-md); }
  .keyword   { background: var(--color-warning-light); color: var(--color-warning-dark); padding: var(--space-1) var(--space-2); border-radius: var(--radius-sm); font-size: var(--font-size-xs); }
  .keyword strong { font-size: var(--font-size-sm); letter-spacing: var(--letter-spacing-wide); }
  .max-words { color: var(--color-text-muted); font-size: var(--font-size-xs); margin-left: auto; }

  .sentence1 { color: var(--color-neutral-700); font-size: var(--font-size-base); line-height: var(--line-height-base); font-style: italic; }

  .sentence2-wrap { display: flex; flex-direction: column; gap: var(--space-1); }
  .s2-label {
    font-size:      var(--font-size-xs);
    font-weight:    var(--font-weight-bold);
    text-transform: uppercase;
    letter-spacing: var(--letter-spacing-wide);
    color:          var(--color-text-muted);
  }
  .sentence2 {
    font-size:   var(--font-size-base);
    line-height: var(--line-height-loose);
    color:       var(--color-text);
    display:     inline;
  }

  .gap-input {
    display:        inline-block;
    border:         none;
    border-bottom:  2px solid var(--color-primary);
    background:     var(--color-primary-light);
    border-radius:  var(--radius-sm) var(--radius-sm) 0 0;
    padding:        var(--space-1) var(--space-2);
    font-size:      var(--font-size-base);
    font-family:    inherit;
    color:          var(--color-text);
    outline:        none;
    min-width:      180px;
    width:          200px;
    transition:     border-color var(--transition-base), background var(--transition-base);
    vertical-align: baseline;
  }
  .gap-input:focus        { border-color: var(--color-primary-hover); background: var(--color-primary-muted); }
  .gap-input::placeholder { color: var(--color-text-faint); font-style: italic; font-size: var(--font-size-sm); }

  .submit-bar {
    display:         flex;
    align-items:     center;
    justify-content: flex-end;
    gap:             var(--space-4);
    flex-wrap:       wrap;
    padding-top:     var(--space-2);
  }
  .hint       { color: var(--color-warning); font-size: var(--font-size-sm); }
  .submit-btn {
    display:     flex;
    align-items: center;
    gap:         var(--space-2);
    padding:     var(--space-3) var(--space-8);
    font-size:   var(--font-size-base);
    font-weight: var(--font-weight-semibold);
  }
</style>