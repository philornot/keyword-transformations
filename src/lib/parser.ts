/**
 * @fileoverview KWT-tuned heuristic parser for OCR output and pasted plain text.
 *
 * Exports a single public entry point `parseQuestions(rawText, type)` that
 * dispatches to the correct internal parser based on exercise type:
 *
 *   'kwt'         → `parseKwtBlock`   — expects a standalone keyword line
 *                                        between sentence1 and sentence2.
 *   'grammar'
 *   'translation' → `parseGapBlock`   — each numbered block is a single gapped
 *                                        sentence; no sentence1 or keyword.
 *
 * Both parsers share the same block-splitting logic and OCR post-processing.
 * This module contains no Node.js imports and is safe to use in browser context.
 */

import type {ParsedKWTQuestion} from './types.js';
import type {ExerciseType} from './constants.js';
import {CANONICAL_GAP} from './constants.js';

// ---------------------------------------------------------------------------
// Shared regexes
// ---------------------------------------------------------------------------

/**
 * Matches numbered exercise starts in both formats:
 *   "1. text"   — simple
 *   "9.1. text" — compound matura-style
 */
const QUESTION_START_RE = /^\s*(\d+(?:[.]\d+)*[.)]\s?)\s*(.*)/;

/**
 * A standalone keyword line: a single word, 2–20 letters, ALL-CAPS or
 * title-cased. OCR sometimes down-cases the keyword, so we accept any-case
 * single word here and uppercase it later.
 */
const KEYWORD_RE = /^[A-Za-z]{2,20}$/;

/**
 * Visual gap representations produced by scanners / Tesseract or pasted
 * from PDF/Word documents:
 *  - 3+ underscores   (most common)
 *  - repeated em/en dashes
 *  - 4+ regular hyphens (Tesseract artefact)
 *  - 5+ dots
 */
const GAP_RE = /_{3,}|—{2,}|-{4,}|\.{5,}/g;

// ---------------------------------------------------------------------------
// OCR post-processing
// ---------------------------------------------------------------------------

/** Common single-character substitution errors produced by Tesseract. */
const CHAR_FIXES: Array<[RegExp, string]> = [[/(?<!\w)\|(?!\w)/g, 'I'],];

/**
 * Cleans up common Tesseract character-recognition errors in raw OCR text.
 *
 * @param text - Raw string from Tesseract or pdf-parse.
 * @returns Cleaned string with known substitution errors corrected.
 */
function fixOcrArtefacts(text: string): string {
    let result = text;
    for (const [pattern, replacement] of CHAR_FIXES) {
        result = result.replace(pattern, replacement);
    }
    return result;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parses raw OCR text or pasted plain text into exercise question drafts.
 *
 * Dispatches to the appropriate internal parser based on `type`:
 *  - 'kwt'                    → {@link parseKwtBlock}
 *  - 'grammar' | 'translation' → {@link parseGapBlock}
 *
 * Safe to call in browser context (no Node.js APIs used).
 *
 * @param rawText - Plain text string from Tesseract, pdf-parse, or clipboard.
 * @param type - Exercise type that controls which parser is used.
 * @returns Array of partially-filled {@link ParsedKWTQuestion} objects.
 */
export function parseQuestions(rawText: string, type: ExerciseType = 'kwt',): ParsedKWTQuestion[] {
    const cleaned = fixOcrArtefacts(rawText);
    const lines = cleaned
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

    const blocks = splitIntoBlocks(lines);
    const parseBlock = type === 'kwt' ? parseKwtBlock : parseGapBlock;

    return blocks
        .map(parseBlock)
        .filter((q) => q.sentence2WithGap.trim().length > 0);
}

// ---------------------------------------------------------------------------
// Block splitting (shared)
// ---------------------------------------------------------------------------

/**
 * Groups lines into per-question blocks delimited by numbered question starts.
 *
 * @param lines - Trimmed, non-empty lines from the source text.
 * @returns Array of line groups, one per question.
 */
function splitIntoBlocks(lines: string[]): string[][] {
    const blocks: string[][] = [];
    let current: string[] = [];

    for (const line of lines) {
        if (QUESTION_START_RE.test(line)) {
            if (current.length) blocks.push(current);
            current = [line];
        } else if (current.length) {
            current.push(line);
        }
    }
    if (current.length) blocks.push(current);
    return blocks;
}

// ---------------------------------------------------------------------------
// KWT parser
// ---------------------------------------------------------------------------

/**
 * Converts one block of lines into a KWT {@link ParsedKWTQuestion}.
 *
 * Strategy:
 *  - Find the first line that looks like a standalone keyword (KEYWORD_RE).
 *  - Lines before it → sentence1 (joined with spaces).
 *  - Lines after it  → sentence2 (joined with spaces).
 *  - Normalise any gap marker in sentence2 to `______`.
 *  - If no gap is found, insert a fallback gap.
 *
 * @param block - Lines belonging to one numbered question.
 * @returns Parsed KWT question draft.
 */
function parseKwtBlock(block: string[]): ParsedKWTQuestion {
    const firstMatch = block[0].match(QUESTION_START_RE);
    const afterNumber = firstMatch ? firstMatch[2].trim() : block[0];

    const allLines = [afterNumber, ...block.slice(1)].filter((l) => l.length > 0);

    const kwIdx = allLines.findIndex((l) => KEYWORD_RE.test(l));

    let keyword = '';
    let s1Lines: string[];
    let s2Lines: string[];

    if (kwIdx === -1) {
        keyword = '';
        s1Lines = allLines;
        s2Lines = [];
    } else {
        keyword = allLines[kwIdx].toUpperCase();
        s1Lines = allLines.slice(0, kwIdx);
        s2Lines = allLines.slice(kwIdx + 1);
    }

    const sentence1 = s1Lines.join(' ').trim();
    const rawS2 = s2Lines.join(' ').trim();
    const sentence2WithGap = normaliseGap(rawS2);

    return {
        sentence1,
        sentence2WithGap,
        keyword,
        correctAnswer: null,
        alternativeAnswers: [],
        exampleWrongAnswers: [],
        minWords: 0,
        maxWords: 0,
    };
}

// ---------------------------------------------------------------------------
// Gap parser (grammar / translation)
// ---------------------------------------------------------------------------

/**
 * Converts one block of lines into a grammar/translation {@link ParsedKWTQuestion}.
 *
 * The entire block (minus the question number prefix) becomes sentence2WithGap.
 * sentence1 and keyword are left empty — the hint is embedded in the sentence
 * itself as a parenthesised segment, e.g. `(he / complete)` or `(z pewnością)`.
 *
 * @param block - Lines belonging to one numbered question.
 * @returns Parsed gap question draft.
 */
function parseGapBlock(block: string[]): ParsedKWTQuestion {
    const firstMatch = block[0].match(QUESTION_START_RE);
    const afterNumber = firstMatch ? firstMatch[2].trim() : block[0];

    const allLines = [afterNumber, ...block.slice(1)].filter((l) => l.length > 0);
    const rawS2 = allLines.join(' ').trim();
    const sentence2WithGap = normaliseGap(rawS2);

    return {
        sentence1: '',
        sentence2WithGap,
        keyword: '',
        correctAnswer: null,
        alternativeAnswers: [],
        exampleWrongAnswers: [],
        minWords: 0,
        maxWords: 0,
    };
}

// ---------------------------------------------------------------------------
// Shared gap helpers
// ---------------------------------------------------------------------------

/**
 * Normalises gap markers in a sentence string to the canonical `______` form.
 * If no gap marker is found, inserts a fallback gap at a heuristic position.
 *
 * @param raw - Raw sentence string, possibly containing OCR gap artefacts.
 * @returns Sentence with exactly one canonical `______` gap.
 */
function normaliseGap(raw: string): string {
    if (!raw) return '';
    if (GAP_RE.test(raw)) return raw.replace(GAP_RE, CANONICAL_GAP).trim();
    return insertFallbackGap(raw);
}

/**
 * Inserts a canonical gap into a sentence string that contains no gap marker.
 *
 * Heuristic: split at the first sentence-internal dash or comma; fall back
 * to inserting after the first 3–4 words.
 *
 * @param s - Raw sentence string with no gap marker.
 * @returns Sentence string with `______` inserted.
 */
function insertFallbackGap(s: string): string {
    const dashMatch = s.match(/^(.+?[,–—])\s+(.+)$/);
    if (dashMatch) {
        return `${dashMatch[1].trim()} ${CANONICAL_GAP} ${dashMatch[2].trim()}`.trim();
    }

    const words = s.split(/\s+/);
    const pivot = Math.min(4, Math.max(1, Math.floor(words.length / 2)));
    return [words.slice(0, pivot).join(' '), CANONICAL_GAP, words.slice(pivot).join(' ')]
        .filter(Boolean)
        .join(' ');
}