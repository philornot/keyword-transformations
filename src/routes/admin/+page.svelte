<script lang="ts">
    import type {ActionData, PageData} from './$types.js';
    import {enhance} from '$app/forms';
    import {ArrowSquareOut, SignOut, Trash} from 'phosphor-svelte';

    let {data, form} = $props<{ data: PageData; form: ActionData }>();

    let deletingSlug = $state<string | null>(null);
</script>

<svelte:head>
    <title>Admin — Key word transformations</title>
</svelte:head>

<div class="admin-page">
    <div class="admin-header">
        <h1>Panel administracyjny</h1>
        {#if data.authenticated}
            <form method="POST" action="?/logout" use:enhance>
                <button class="btn-ghost logout-btn" type="submit">
                    <SignOut size={16} weight="regular"/>
                    Wyloguj
                </button>
            </form>
        {/if}
    </div>

    <!-- ── Login form ──────────────────────────────────────────────── -->
    {#if !data.authenticated}
        <div class="login-wrap card">
            <h2>Zaloguj się</h2>
            <form method="POST" action="?/login" use:enhance class="login-form">
                <label class="field-label" for="password">Hasło</label>
                <input
                        id="password"
                        name="password"
                        type="password"
                        class="text-input"
                        placeholder="Wpisz hasło administratora…"
                        autocomplete="current-password"
                />
                {#if form?.loginError}
                    <p class="error-banner" role="alert">{form.loginError}</p>
                {/if}
                <button class="btn-primary" type="submit">Zaloguj</button>
            </form>
        </div>

        <!-- ── Sets management ────────────────────────────────────────── -->
    {:else}
        <div class="toolbar">
            <p class="sets-count">{data.sets.length} zestawów w bazie</p>
            <div class="toolbar-actions">
                <a href="/create/manual" class="btn-primary new-btn" target="_blank">
                    + Nowy zestaw
                </a>
            </div>
        </div>

        {#if data.sets.length === 0}
            <div class="empty card">Brak zestawów. Utwórz pierwszy używając przycisku powyżej.</div>
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
                            <td class="td-source">
                                {#if s.sourceLabel}
                                    <span class="source-badge">{s.sourceLabel}</span>
                                {:else}
                                    <span class="no-source">—</span>
                                {/if}
                            </td>
                            <td class="center">{s.questionCount}</td>
                            <td class="td-date">{new Date(s.createdAt).toLocaleDateString('pl-PL')}</td>
                            <td class="td-actions">
                                {#if deletingSlug === s.slug}
                                    <div class="confirm-row">
                                        <span class="confirm-label">Na pewno?</span>
                                        <form
                                                method="POST"
                                                action="?/deleteSet"
                                                use:enhance={() => {
                          return ({ update }) => {
                            deletingSlug = null;
                            update();
                          };
                        }}
                                        >
                                            <input type="hidden" name="slug" value={s.slug}/>
                                            <button class="btn-danger confirm-btn" type="submit">Usuń</button>
                                        </form>
                                        <button
                                                class="btn-ghost cancel-btn"
                                                onclick={() => (deletingSlug = null)}
                                                type="button"
                                        >Anuluj
                                        </button>
                                    </div>
                                {:else}
                                    <button
                                            class="btn-ghost delete-btn"
                                            type="button"
                                            onclick={() => (deletingSlug = s.slug)}
                                            aria-label="Usuń zestaw {s.title}"
                                    >
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
    .admin-page {
        display: flex;
        flex-direction: column;
        gap: var(--space-6);
        max-width: 860px;
        margin: 0 auto;
    }

    .admin-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: var(--space-4);
    }

    h1 {
        font-size: var(--font-size-3xl);
        font-weight: var(--font-weight-extrabold);
    }

    h2 {
        font-size: var(--font-size-xl);
        font-weight: var(--font-weight-bold);
    }

    .logout-btn {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        font-size: var(--font-size-sm);
        padding: var(--space-2) var(--space-4);
    }

    /* ── Login ──────────────────────────────────────────────────────── */
    .login-wrap {
        max-width: 380px;
        margin: var(--space-8) auto;
    }

    .login-form {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
        margin-top: var(--space-5);
    }

    /* ── Toolbar ────────────────────────────────────────────────────── */
    .toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: var(--space-3);
    }

    .sets-count {
        color: var(--color-text-muted);
        font-size: var(--font-size-sm);
    }

    .new-btn {
        text-decoration: none;
        font-size: var(--font-size-sm);
    }

    .empty {
        text-align: center;
        color: var(--color-text-faint);
        padding: var(--space-8);
    }

    /* ── Table ──────────────────────────────────────────────────────── */
    .sets-table {
        padding: 0;
        overflow: hidden;
    }

    table {
        width: 100%;
        border-collapse: collapse;
        font-size: var(--font-size-sm);
    }

    thead tr {
        background: var(--color-neutral-100);
        border-bottom: 2px solid var(--color-border);
    }

    th {
        padding: var(--space-3) var(--space-4);
        text-align: left;
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-bold);
        text-transform: uppercase;
        letter-spacing: var(--letter-spacing-wide);
        color: var(--color-text-muted);
        white-space: nowrap;
    }

    td {
        padding: var(--space-3) var(--space-4);
        border-bottom: 1px solid var(--color-border-subtle);
        vertical-align: middle;
    }

    tr:last-child td {
        border-bottom: none;
    }

    tr.deleting td {
        background: var(--color-danger-light);
    }

    .center {
        text-align: center;
    }

    .td-title {
        max-width: 280px;
    }

    .set-link {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        color: var(--color-text);
        font-weight: var(--font-weight-medium);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 100%;
    }

    .set-link:hover {
        color: var(--color-primary);
        text-decoration: none;
    }

    :global(.ext-icon) {
        flex-shrink: 0;
        color: var(--color-text-muted);
    }

    .source-badge {
        background: var(--color-primary-muted);
        color: var(--color-primary);
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-bold);
        padding: 2px var(--space-2);
        border-radius: var(--radius-full);
        white-space: nowrap;
    }

    .no-source {
        color: var(--color-text-faint);
    }

    .td-date {
        color: var(--color-text-muted);
        white-space: nowrap;
    }

    .td-actions {
        width: 1%;
        white-space: nowrap;
    }

    /* ── Delete confirmation ────────────────────────────────────────── */
    .delete-btn {
        padding: var(--space-1) var(--space-2);
        color: var(--color-text-muted);
        opacity: 0.6;
        transition: opacity var(--transition-base), color var(--transition-base);
    }

    .delete-btn:hover {
        opacity: 1;
        color: var(--color-danger);
    }

    .confirm-row {
        display: flex;
        align-items: center;
        gap: var(--space-2);
    }

    .confirm-label {
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-bold);
        color: var(--color-danger-dark);
        white-space: nowrap;
    }

    .confirm-btn {
        font-size: var(--font-size-xs);
        padding: var(--space-1) var(--space-3);
    }

    .cancel-btn {
        font-size: var(--font-size-xs);
        padding: var(--space-1) var(--space-3);
    }
</style>