/**
 * @fileoverview KWT-tuned heuristic parser for OCR output.
 *
 * Handles both simple numbering ("1.") and compound numbering ("9.1.")
 * as used in Polish matura exam sheets. Sentence2 continuation lines
 * (text on the line immediately after the gap line) are correctly joined.
 */

import type {ParsedKWTQuestion} from '../types.js';

/**
 * Matches the start of a numbered exercise in both formats:
 *   "1. text"    — simple numbering
 *   "9.1. text"  — compound matura-style numbering
 */
const QUESTION_START_RE = /^\s*(\d+(?:[.]\d+)*[.)]\s?)\s*(.*)/;

/** A standalone keyword line: single word, all uppercase, 2–20 chars. */
const KEYWORD_RE = /^[A-Z]{2,20}$/;

/**
 * Any visual representation of a gap:
 *  - 3+ underscores
 *  - repeated em/en dashes
 *  - 5+ dots used as blanks
 */
const GAP_RE = /_{3,}|—{2,}|-{4,}|\.{5,}/g;

/** Canonical gap string stored in the database and shown in the UI. */
const CANONICAL_GAP = '______';

/**
 * Parses raw OCR text into KWT question drafts.
 *
 * @param rawText - Plain text string from Tesseract or pdf-parse.
 * @returns Array of partially-filled {@link ParsedKWTQuestion} objects.
 */
export function parseQuestions(rawText: string): ParsedKWTQuestion[] {
    const lines = rawText
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
 * Strategy:
 *  1. Strip the leading question number from the first line.
 *  2. Scan lines to find the keyword (all-caps single word) and the gap line.
 *  3. Lines before the gap (excluding the keyword) form sentence1.
 *  4. The gap line plus any immediately following non-keyword, non-question
 *     lines form sentence2. This handles the common matura layout where
 *     sentence2 wraps onto a second line, e.g.:
 *       "I wish I ______ so that I wouldn't"
 *       "have failed my exams."
 *
 * @param block - Lines belonging to one numbered question.
 * @returns Parsed question draft with empty answer arrays.
 */
function parseBlock(block: string[]): ParsedKWTQuestion {
    const firstMatch = block[0].match(QUESTION_START_RE);
    const afterNumber = firstMatch ? firstMatch[2].trim() : block[0];

    const allLines = [afterNumber, ...block.slice(1)].filter((l) => l.length > 0);

    let keyword = '';
    let gapLineIdx = -1;
    const s1Parts: string[] = [];

    // ── First pass: find keyword and gap line ──────────────────────────
    for (let i = 0; i < allLines.length; i++) {
        const line = allLines[i];

        if (!keyword && KEYWORD_RE.test(line)) {
            keyword = line.trim();
            continue;
        }

        if (gapLineIdx === -1 && GAP_RE.test(line)) {
            gapLineIdx = i;
            continue;
        }

        // Accumulate sentence1 only from lines before the gap is found.
        if (gapLineIdx === -1) {
            s1Parts.push(line);
        }
    }

    // ── Build sentence2: gap line + continuation lines ─────────────────
    const s2Parts: string[] = [];

    if (gapLineIdx !== -1) {
        // Normalise the gap on the gap line itself.
        s2Parts.push(allLines[gapLineIdx].replace(GAP_RE, CANONICAL_GAP).trim());

        // Collect continuation lines that come after the gap line.
        // Stop if we hit another keyword or another question start.
        for (let i = gapLineIdx + 1; i < allLines.length; i++) {
            const line = allLines[i];
            if (KEYWORD_RE.test(line)) break; // next keyword
            if (QUESTION_START_RE.test(line)) break; // next question
            s2Parts.push(line.trim());
        }
    }

    return {
        sentence1: s1Parts.join(' ').trim(),
        sentence2WithGap: s2Parts.join(' ').trim(),
        keyword,
        correctAnswer: null,
        alternativeAnswers: [],
        exampleWrongAnswers: [],
        maxWords: 5,
    };
}