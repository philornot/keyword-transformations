<script lang="ts">
    /**
     * /create/scan — file upload page with OCR processing.
     *
     * Reads the active exercise mode from the global `mode` store set by
     * the nav tabs. Parsing (both OCR and clipboard text) always uses that
     * mode so the correct question structure is produced.
     */

    import {goto} from '$app/navigation';
    import {reviewState} from '$lib/store.svelte.js';
    import {mode} from '$lib/mode.svelte.js';
    import {t} from '$lib/i18n.svelte.js';
    import {parseQuestions} from '$lib/parser.js';
    import type {UploadResponse} from '$lib/types.js';
    import {
        CircleNotchIcon,
        ClipboardIcon,
        CloudArrowUpIcon,
        FilePdfIcon,
        ImageIcon,
        MagnifyingGlassIcon,
        WarningCircleIcon,
        XIcon,
    } from 'phosphor-svelte';

    const MAX_MB = 20;
    const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

    let isDragging = $state(false);
    let isProcessing = $state(false);
    let errorMessage = $state('');
    let selectedFile = $state<File | null>(null);
    let pastedImage = $state(false);

    /**
     * Validates and stores the chosen file, clearing any previous error.
     *
     * @param file - The file from the input or drop event.
     */
    function handleFile(file: File): void {
        errorMessage = '';
        if (!ACCEPTED.includes(file.type)) {
            errorMessage = t('scan.errorType');
            return;
        }
        if (file.size > MAX_MB * 1024 * 1024) {
            errorMessage = t('scan.errorSize');
            return;
        }
        selectedFile = file;
        pastedImage = false;
    }

    function onInput(e: Event): void {
        const f = (e.target as HTMLInputElement).files?.[0];
        if (f) handleFile(f);
        (e.target as HTMLInputElement).value = '';
    }

    function onDragOver(e: DragEvent): void {
        e.preventDefault();
        isDragging = true;
    }

    function onDragLeave(): void {
        isDragging = false;
    }

    function onDrop(e: DragEvent): void {
        e.preventDefault();
        isDragging = false;
        const f = e.dataTransfer?.files[0];
        if (f) handleFile(f);
    }

    /**
     * Global Ctrl+V handler. Uses the current `mode.type` for parsing.
     * Pastes originating inside an input or textarea are ignored.
     *
     * @param e - The window-level ClipboardEvent.
     */
    async function onGlobalPaste(e: ClipboardEvent): Promise<void> {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;

        errorMessage = '';

        const imageItem = Array.from(e.clipboardData?.items ?? []).find(
            (item) => item.type.startsWith('image/'),
        );
        if (imageItem) {
            const file = imageItem.getAsFile();
            if (!file) return;
            selectedFile = new File([file], 'screenshot.png', {type: file.type});
            pastedImage = true;
            return;
        }

        const text = e.clipboardData?.getData('text/plain') ?? '';
        if (!text.trim()) return;

        isProcessing = true;
        try {
            const questions = parseQuestions(text, mode.type);
            if (questions.length === 0) {
                errorMessage = 'Nie udało się wykryć żadnych pytań w wklejonym tekście. Sprawdź format lub utwórz zestaw ręcznie.';
                return;
            }
            reviewState.questions = questions;
            reviewState.rawText = text;
            reviewState.title = '';
            reviewState.type = mode.type;
            await goto('/review');
        } finally {
            isProcessing = false;
        }
    }

    /**
     * Formats a byte count to a human-readable size string.
     *
     * @param bytes - Raw byte count.
     * @returns Human-readable string like "1.4 MB".
     */
    function fmt(bytes: number): string {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
    }

    /** Uploads the selected file, runs OCR, then navigates to /review. */
    async function process(): Promise<void> {
        if (!selectedFile) return;
        isProcessing = true;
        errorMessage = '';
        try {
            const fd = new FormData();
            fd.append('file', selectedFile);
            const res = await fetch('/api/upload', {method: 'POST', body: fd});

            if (!res.ok) {
                let message = 'Upload failed.';
                try {
                    message = (await res.json()).error ?? message;
                } catch { /* non-JSON */
                }
                errorMessage = message;
                return;
            }

            const data: UploadResponse = await res.json();
            // Parse using the active mode — the server always returns rawText
            // but does not know which exercise type the user selected.
            const questions = parseQuestions(data.rawText, mode.type);

            if (questions.length === 0) {
                errorMessage = 'Nie udało się wykryć żadnych pytań w tym pliku. Sprawdź jakość zdjęcia lub utwórz zestaw ręcznie.';
                return;
            }

            reviewState.questions = questions;
            reviewState.rawText = data.rawText;
            reviewState.title = selectedFile.name.replace(/\.[^.]+$/, '');
            reviewState.type = mode.type;
            await goto('/review');
        } catch (err) {
            errorMessage = err instanceof Error ? err.message : 'Nieznany błąd. Spróbuj ponownie.';
        } finally {
            isProcessing = false;
        }
    }

    const typeLabels: Record<string, string> = {
        kwt: 'KWT',
        grammar: 'Gramatykalizacja',
        translation: 'Tłumaczenia',
    };
</script>

<svelte:window onpaste={onGlobalPaste}/>

<svelte:head>
    <title>{t('scan.title')} — {typeLabels[mode.type]} — Key word transformations</title>
</svelte:head>

<div class="scan-page">
    <div class="page-title-row">
        <h1>{t('scan.title')}</h1>
        <span class="type-badge">{typeLabels[mode.type]}</span>
    </div>
    <p class="subtitle">{t('scan.subtitle')}</p>

    {#if !selectedFile && !isProcessing}
        <div class="paste-hint">
            <ClipboardIcon size={14} weight="bold" class="paste-icon"/>
            <span>
                Wklej <kbd>Ctrl+V</kbd> screenshot lub skopiowany tekst z pytaniami
                — zestaw zostanie wykryty automatycznie.
            </span>
        </div>
    {/if}

    <div
            class="drop-zone card"
            class:dragging={isDragging}
            class:has-file={selectedFile}
            ondragover={onDragOver}
            ondragleave={onDragLeave}
            ondrop={onDrop}
            role="button"
            tabindex="0"
            aria-label="Drop zone"
            onkeydown={(e) => e.key === 'Enter' && document.getElementById('fi')?.click()}
    >
        {#if selectedFile}
            <div class="file-preview">
                <span class="file-icon">
                    {#if pastedImage}
                        <ClipboardIcon size={36} weight="duotone"/>
                    {:else if selectedFile.type === 'application/pdf'}
                        <FilePdfIcon size={36} weight="duotone"/>
                    {:else}
                        <ImageIcon size={36} weight="duotone"/>
                    {/if}
                </span>
                <div class="file-info">
                    <strong>{pastedImage ? 'Wklejony screenshot' : selectedFile.name}</strong>
                    <span class="size">{fmt(selectedFile.size)}</span>
                </div>
                <button
                        class="btn-ghost rm-btn"
                        onclick={() => { selectedFile = null; pastedImage = false; errorMessage = ''; }}
                        aria-label={t('scan.removeFile')}
                >
                    <XIcon size={14} weight="bold"/>
                </button>
            </div>
        {:else}
            <div class="drop-hint">
                <CloudArrowUpIcon size={48} weight="light"/>
                <p><strong>{t('scan.dropHint')}</strong></p>
                <p class="or">{t('scan.or')}</p>
                <label class="pick-btn btn-primary" for="fi">{t('scan.browse')}</label>
            </div>
        {/if}
        <input id="fi" type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" hidden onchange={onInput}/>
    </div>

    {#if isProcessing && !selectedFile}
        <div class="processing-text">
            <CircleNotchIcon size={16} weight="bold" class="spin"/>
            Analizuję tekst…
        </div>
    {/if}

    {#if errorMessage}
        <div class="error-banner" role="alert">
            <WarningCircleIcon size={16} weight="bold"/>
            <span>{errorMessage}</span>
        </div>
    {/if}

    <div class="actions">
        <button
                class="btn-primary process-btn"
                disabled={!selectedFile || isProcessing}
                onclick={process}
        >
            {#if isProcessing && selectedFile}
                <CircleNotchIcon size={18} weight="bold" class="spin"/> {t('scan.processing')}
            {:else}
                <MagnifyingGlassIcon size={18} weight="regular"/> {t('scan.process')}
            {/if}
        </button>
    </div>
</div>

<style>
    .scan-page {
        max-width: 600px;
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        gap: var(--space-5);
    }

    .page-title-row {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        flex-wrap: wrap;
    }

    h1 {
        font-size: var(--font-size-3xl);
        font-weight: var(--font-weight-extrabold);
    }

    .type-badge {
        background: var(--color-primary);
        color: var(--color-surface);
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-bold);
        padding: var(--space-1) var(--space-3);
        border-radius: var(--radius-full);
        letter-spacing: var(--letter-spacing-wide);
    }

    .subtitle {
        color: var(--color-text-muted);
        font-size: var(--font-size-sm);
        margin-top: calc(-1 * var(--space-3));
    }

    .paste-hint {
        display: flex;
        align-items: baseline;
        gap: var(--space-2);
        background: var(--color-primary-light);
        color: var(--color-primary);
        border: 1px solid var(--color-primary-muted);
        border-radius: var(--radius-md);
        padding: var(--space-3) var(--space-4);
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-medium);
        line-height: var(--line-height-snug);
    }

    :global(.paste-icon) {
        flex-shrink: 0;
        position: relative;
        top: 2px;
    }

    kbd {
        display: inline-block;
        background: var(--color-surface);
        border: 1px solid var(--color-primary-muted);
        border-radius: var(--radius-sm);
        padding: 0 5px;
        font-family: var(--font-mono), monospace;
        font-size: 0.8em;
        font-weight: var(--font-weight-bold);
        box-shadow: 0 1px 0 var(--color-primary-muted);
        vertical-align: baseline;
    }

    .drop-zone {
        min-height: 210px;
        border: 2px dashed var(--color-border);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: border-color var(--transition-base), background var(--transition-base);
        cursor: pointer;
    }

    .drop-zone.dragging {
        border-color: var(--color-primary);
        background: var(--color-primary-light);
    }

    .drop-zone.has-file {
        border-style: solid;
        border-color: var(--color-primary);
        cursor: default;
    }

    .drop-hint {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--space-2);
        color: var(--color-text-muted);
        text-align: center;
    }

    .or {
        color: var(--color-text-faint);
    }

    .pick-btn {
        display: inline-block;
        padding: var(--space-2) var(--space-5);
        border-radius: var(--radius-md);
        cursor: pointer;
        font-weight: var(--font-weight-semibold);
        font-size: var(--font-size-sm);
        font-family: inherit;
        margin-top: var(--space-1);
    }

    .file-preview {
        display: flex;
        align-items: center;
        gap: var(--space-4);
        width: 100%;
    }

    .file-icon {
        color: var(--color-primary);
        flex-shrink: 0;
    }

    .file-info {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }

    .file-info strong {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .size {
        color: var(--color-text-muted);
        font-size: var(--font-size-xs);
    }

    .rm-btn {
        padding: var(--space-1) var(--space-2);
        flex-shrink: 0;
    }

    .processing-text {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        color: var(--color-text-muted);
        font-size: var(--font-size-sm);
    }

    .error-banner {
        display: flex;
        align-items: flex-start;
        gap: var(--space-2);
        color: var(--color-danger-dark);
        background: var(--color-danger-light);
        border: 1px solid var(--color-danger-border);
        border-radius: var(--radius-md);
        padding: var(--space-3) var(--space-4);
        font-size: var(--font-size-sm);
        line-height: var(--line-height-snug);
    }

    .actions {
        display: flex;
        justify-content: flex-end;
    }

    .process-btn {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-3) var(--space-8);
        font-weight: var(--font-weight-semibold);
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