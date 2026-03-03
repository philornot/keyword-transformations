/**
 * @fileoverview KWT-tuned heuristic parser for OCR output.
 *
 * Handles both simple numbering ("1.") and compound numbering ("9.1.")
 * as used in Polish matura exam sheets.
 *
 * Key insight: the KWT block structure is deterministic regardless of
 * whether the gap marker survived OCR:
 *
 *   9.1. <sentence1 — may span multiple lines>
 *        KEYWORD
 *        <sentence2 — may span multiple lines, may or may not contain gap>
 *
 * We split on the keyword line, not on the gap line.  If a gap marker
 * exists in sentence2 we normalise it; if it doesn't (Tesseract skipped
 * the physical underline), we insert a canonical gap at the first
 * plausible break point so the editor shows something the user can fix.
 */

import type {ParsedKWTQuestion} from '../types.js';
import {CANONICAL_GAP} from '../constants.js';

/**
 * Matches numbered exercise starts in both formats:
 *   "1. text"   — simple
 *   "9.1. text" — compound matura-style
 */
const QUESTION_START_RE = /^\s*(\d+(?:[.]\d+)*[.)]\s?)\s*(.*)/;

/** A standalone keyword line: single word, all uppercase, 2–20 chars. */
const KEYWORD_RE = /^[A-Z]{2,20}$/;

/**
 * Visual gap representations produced by scanners / Tesseract:
 *  - 3+ underscores
 *  - repeated em/en dashes
 *  - 4+ regular hyphens (Tesseract artefact)
 *  - 5+ dots
 */
const GAP_RE = /_{3,}|—{2,}|-{4,}|\.{5,}/g;

// ---------------------------------------------------------------------------
// OCR post-processing
// ---------------------------------------------------------------------------

/**
 * Common single-character substitution errors produced by Tesseract
 * when scanning serif fonts.
 *
 * `|` → `I` is applied only when the pipe stands alone as a word
 * (surrounded by whitespace or at line boundaries) so we never corrupt
 * legitimate pipe characters in other contexts.
 */
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
 * Parses raw OCR text into KWT question drafts.
 *
 * @param rawText - Plain text string from Tesseract or pdf-parse.
 * @returns Array of partially-filled {@link ParsedKWTQuestion} objects.
 */
export function parseQuestions(rawText: string): ParsedKWTQuestion[] {
    const cleaned = fixOcrArtefacts(rawText);

    const lines = cleaned
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

    const blocks = splitIntoBlocks(lines);
    return blocks
        .map(parseBlock)
        .filter((q) => q.sentence1.trim().length > 0);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * Groups lines into per-question blocks delimited by numbered question starts.
 *
 * @param lines - Trimmed, non-empty lines from OCR output.
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

/**
 * Converts one block of lines into a {@link ParsedKWTQuestion}.
 *
 * The split strategy is based on the keyword line, not the gap line:
 *
 *  - Lines BEFORE the keyword → sentence1 (joined with spaces).
 *  - Lines AFTER the keyword  → sentence2 (joined with spaces).
 *
 * Within sentence2 we then look for a gap marker and normalise it to
 * `______`.  If no gap marker is found (Tesseract treated the physical
 * underline as whitespace and dropped it), we insert `______` at the
 * first sentence boundary — either just before a word that starts a new
 * clause, or at the end — so the editor always has a gap to show.
 *
 * `minWords` and `maxWords` are intentionally left at 0 (no limit) because
 * OCR cannot infer the intended word count from the source document.
 * The editor allows the teacher to fill these in manually.
 *
 * @param block - Lines belonging to one numbered question.
 * @returns Parsed question draft with empty answer arrays and no word limit.
 */
function parseBlock(block: string[]): ParsedKWTQuestion {
    const firstMatch = block[0].match(QUESTION_START_RE);
    const afterNumber = firstMatch ? firstMatch[2].trim() : block[0];

    const allLines = [afterNumber, ...block.slice(1)].filter((l) => l.length > 0);

    // Find the index of the keyword line.
    const kwIdx = allLines.findIndex((l) => KEYWORD_RE.test(l));

    let keyword = '';
    let s1Lines: string[];
    let s2Lines: string[];

    if (kwIdx === -1) {
        // No keyword found — put everything in sentence1, leave sentence2 blank.
        keyword = '';
        s1Lines = allLines;
        s2Lines = [];
    } else {
        keyword = allLines[kwIdx];
        s1Lines = allLines.slice(0, kwIdx);
        s2Lines = allLines.slice(kwIdx + 1);
    }

    const sentence1 = s1Lines.join(' ').trim();

    // Build sentence2 and normalise gap markers.
    const rawS2 = s2Lines.join(' ').trim();
    const hasGap = GAP_RE.test(rawS2);

    let sentence2WithGap: string;

    if (hasGap) {
        // Normalise all gap representations to the canonical marker.
        sentence2WithGap = rawS2.replace(GAP_RE, CANONICAL_GAP).trim();
    } else if (rawS2.length > 0) {
        // Tesseract dropped the physical underline entirely.
        // Insert the gap at the most natural break point so the user has
        // something to work with in the editor.
        sentence2WithGap = insertFallbackGap(rawS2);
    } else {
        sentence2WithGap = '';
    }

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

/**
 * Inserts a canonical gap into a sentence2 string that contains no gap marker.
 *
 * Heuristic: find the longest run of whitespace-separated words that
 * looks like a "stem" (the part before the blank) by searching for a
 * sentence-internal boundary such as a comma, dash, or a word that
 * immediately follows an auxiliary verb pattern.  Falls back to inserting
 * the gap after the first word cluster (up to 4 words) so there is always
 * visible content on both sides of the gap.
 *
 * @param s - Raw sentence2 string with no gap marker.
 * @returns Sentence2 string with `______` inserted.
 */
function insertFallbackGap(s: string): string {
    // Try to split at a sentence-internal dash or comma which often marks
    // the boundary between the stem and the gap in matura sentences.
    const dashMatch = s.match(/^(.+?[,–—])\s+(.+)$/);
    if (dashMatch) {
        return `${dashMatch[1].trim()} ${CANONICAL_GAP} ${dashMatch[2].trim()}`.trim();
    }

    // Fall back: insert after the first 3–4 words.
    const words = s.split(/\s+/);
    const pivot = Math.min(4, Math.max(1, Math.floor(words.length / 2)));
    return [words.slice(0, pivot).join(' '), CANONICAL_GAP, words.slice(pivot).join(' '),]
        .filter(Boolean)
        .join(' ');
}