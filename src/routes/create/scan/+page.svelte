<script lang="ts">
    /**
     * /create/scan — file upload page with OCR processing.
     * Sends result to reviewState then navigates to /review.
     */

    import {goto} from '$app/navigation';
    import {reviewState} from '$lib/store.svelte.js';
    import {t} from '$lib/i18n.svelte.js';
    import type {UploadResponse} from '$lib/types.js';
    import {CircleNotch, CloudArrowUp, FilePdf, Image, MagnifyingGlass, X,} from 'phosphor-svelte';

    const MAX_MB = 20;
    const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

    let isDragging = $state(false);
    let isProcessing = $state(false);
    let errorMessage = $state('');
    let selectedFile = $state<File | null>(null);

    /**
     * Validates and stores the chosen file.
     * @param file - The file from the input or drop event.
     */
    function handleFile(file: File) {
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
    }

    function onInput(e: Event) {
        const f = (e.target as HTMLInputElement).files?.[0];
        if (f) handleFile(f);
    }

    function onDragOver(e: DragEvent) {
        e.preventDefault();
        isDragging = true;
    }

    function onDragLeave() {
        isDragging = false;
    }

    function onDrop(e: DragEvent) {
        e.preventDefault();
        isDragging = false;
        const f = e.dataTransfer?.files[0];
        if (f) handleFile(f);
    }

    /**
     * Formats bytes to a human-readable size string.
     * @param bytes - Raw byte count.
     * @returns Human-readable string like "1.4 MB".
     */
    function fmt(bytes: number): string {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
    }

    /** Uploads file, runs OCR, then navigates to /review. */
    async function process() {
        if (!selectedFile) return;
        isProcessing = true;
        errorMessage = '';
        try {
            const fd = new FormData();
            fd.append('file', selectedFile);
            const res = await fetch('/api/upload', {method: 'POST', body: fd});
            if (!res.ok) {
                const {error} = await res.json();
                throw new Error(error ?? 'Upload failed.');
            }
            const data: UploadResponse = await res.json();
            reviewState.questions = data.questions;
            reviewState.rawText = data.rawText;
            reviewState.title = selectedFile.name.replace(/\.[^.]+$/, '');
            goto('/review');
        } catch (err) {
            errorMessage = err instanceof Error ? err.message : 'Unknown error.';
        } finally {
            isProcessing = false;
        }
    }
</script>

<svelte:head><title>{t('scan.title')} — WorksheetApp</title></svelte:head>

<div class="scan-page">
    <h1>{t('scan.title')}</h1>
    <p class="subtitle">{t('scan.subtitle')}</p>

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
          {#if selectedFile.type === 'application/pdf'}
            <FilePdf size={36} weight="duotone"/>
          {:else}
            <Image size={36} weight="duotone"/>
          {/if}
        </span>
                <div class="file-info">
                    <strong>{selectedFile.name}</strong>
                    <span class="size">{fmt(selectedFile.size)}</span>
                </div>
                <button
                        class="btn-ghost rm-btn"
                        onclick={() => (selectedFile = null)}
                        aria-label={t('scan.removeFile')}
                >
                    <X size={14} weight="bold"/>
                </button>
            </div>
        {:else}
            <div class="drop-hint">
                <CloudArrowUp size={48} weight="light" class="drop-icon"/>
                <p><strong>{t('scan.dropHint')}</strong></p>
                <p class="or">{t('scan.or')}</p>
                <label class="pick-btn btn-primary" for="fi">{t('scan.browse')}</label>
            </div>
        {/if}
        <input id="fi" type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" hidden onchange={onInput}/>
    </div>

    {#if errorMessage}
        <p class="error-banner" role="alert">{errorMessage}</p>
    {/if}

    <div class="actions">
        <button
                class="btn-primary process-btn"
                disabled={!selectedFile || isProcessing}
                onclick={process}
        >
            {#if isProcessing}
                <CircleNotch size={18} weight="bold" class="spin"/> {t('scan.processing')}
            {:else}
                <MagnifyingGlass size={18} weight="regular"/> {t('scan.process')}
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

    h1 {
        font-size: var(--font-size-3xl);
        font-weight: var(--font-weight-extrabold);
    }

    .subtitle {
        color: var(--color-text-muted);
        font-size: var(--font-size-sm);
        margin-top: calc(-1 * var(--space-3));
    }

    /* ── Drop zone ────────────────────────────────────────────────────── */
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

    /* ── File preview ─────────────────────────────────────────────────── */
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

    /* ── Actions ──────────────────────────────────────────────────────── */
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