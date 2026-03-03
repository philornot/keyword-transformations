<script lang="ts">
    import type {ActionData, PageData} from './$types.js';
    import {enhance} from '$app/forms';
    import {ArrowSquareOut, PencilSimple, Trash} from 'phosphor-svelte';

    let {data, form} = $props<{ data: PageData; form: ActionData }>();
    let deletingSlug = $state<string | null>(null);
</script>

<svelte:head><title>Admin — Key word transformations</title></svelte:head>

<div class="admin-page">
    {#if !data.authenticated}
        <div class="login-wrap card">
            <h1>Panel administracyjny</h1>
            <form method="POST" action="?/login" use:enhance class="login-form">
                <label class="field-label" for="password">Hasło</label>
                <input id="password" name="password" type="password" class="text-input"
                       placeholder="Wpisz hasło administratora…" autocomplete="current-password"/>
                {#if form?.loginError}
                    <p class="error-banner" role="alert">{form.loginError}</p>
                {/if}
                <button class="btn-primary" type="submit">Zaloguj</button>
            </form>
        </div>
    {:else}
        <div class="panel-header">
            <div>
                <h1>Panel administracyjny</h1>
                <p class="panel-sub">Publiczne zestawy widoczne na stronie głównej</p>
            </div>
            <a href="/create/manual" class="btn-primary new-btn">+ Nowy zestaw</a>
        </div>

        {#if data.sets.length === 0}
            <div class="empty card">Brak publicznych zestawów. Utwórz pierwszy używając przycisku powyżej.</div>
        {:else}
            <div class="sets-table card">
                <table>
                    <thead>
                    <tr>
                        <th>Tytuł</th>
                        <th>Źródło</th>
                        <th class="center">Pyt.</th>
                        <th>Dodano</th>
                        <th></th>
                    </tr>
                    </thead>
                    <tbody>
                    {#each data.sets as s (s.slug)}
                        <tr class:deleting={deletingSlug === s.slug}>
                            <td class="td-title">
                                <a href="/set/{s.slug}" target="_blank" class="set-link">
                                    {s.title}
                                    <ArrowSquareOut size={12} weight="bold" class="ext-icon"/>
                                </a>
                            </td>
                            <td>
                                {#if s.sourceLabel}<span class="source-badge">{s.sourceLabel}</span>{:else}<span
                                        class="no-source">—</span>{/if}
                            </td>
                            <td class="center">{s.questionCount}</td>
                            <td class="td-date">{new Date(s.createdAt).toLocaleDateString('pl-PL')}</td>
                            <td class="td-actions">
                                {#if deletingSlug === s.slug}
                                    <div class="confirm-row">
                                        <span class="confirm-label">Na pewno?</span>
                                        <form method="POST" action="?/deleteSet"
                                              use:enhance={() => ({ update }) => { deletingSlug = null; update(); }}>
                                            <input type="hidden" name="slug" value={s.slug}/>
                                            <button class="btn-danger confirm-btn" type="submit">Usuń</button>
                                        </form>
                                        <button class="btn-ghost cancel-btn" onclick={() => (deletingSlug = null)}
                                                type="button">Anuluj
                                        </button>
                                    </div>
                                {:else}
                                    <a
                                            href="/edit/{s.slug}"
                                            class="btn-ghost edit-btn"
                                            aria-label="Edytuj {s.title}"
                                    >
                                        <PencilSimple size={15} weight="regular"/>
                                    </a>
                                    <button class="btn-ghost delete-btn" type="button"
                                            onclick={() => (deletingSlug = s.slug)} aria-label="Usuń {s.title}">
                                        <Trash size={15} weight="regular"/>
                                    </button>
                                {/if}
                            </td>
                        </tr>
                    {/each}
                    </tbody>
                </table>
            </div>
        {/if}
    {/if}
</div>

<style>
    .edit-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: var(--space-1) var(--space-2);
        font-size: var(--font-size-xs);
    }

    .td-actions {
        display: flex;
        align-items: center;
        gap: var(--space-2);
    }
</style>