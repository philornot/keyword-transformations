/**
 * @fileoverview KWT-tuned heuristic parser for OCR output.
 *
 * Key Word Transformation format (Cambridge B2/C1 style):
 *   32. Full original sentence ending with a period.
 *        KEYWORD
 *        Second sentence with a ______ gap to fill.
 *
 * Recognition rules:
 *  1. Question block starts with a numbered line: "32." or "32)"
 *  2. A line that is a single ALL-CAPS word (2–20 chars) is the keyword.
 *  3. A line containing underscores (___) or a long dash sequence is the
 *     gapped sentence. We normalise all gap representations to `______`.
 *  4. The remaining lines before the gap form sentence1.
 *
 * The parser is intentionally lenient — the review step lets users fix
 * anything that was mis-detected.
 */

import type { ParsedKWTQuestion } from '../types.js';

/** Matches the start of a numbered exercise: "32. " or "32) " */
const QUESTION_START_RE = /^\s*(\d{1,3})[.)]\s+(.*)/;

/** A standalone keyword line: single word, all uppercase, 2–20 chars. */
const KEYWORD_RE = /^[A-Z]{2,20}$/;

/**
 * Any representation of a gap:
 *  - 3+ underscores
 *  - em-dash / en-dash sequences
 *  - dots sequences used as blanks (5+)
 */
const GAP_RE = /_{3,}|—{2,}|\.{5,}/g;

/** Canonical gap string stored in the database and shown in the UI. */
const CANONICAL_GAP = '______';

/**
 * Parses raw OCR text (from an image or PDF) into KWT question drafts.
 *
 * @param rawText - Plain text string from Tesseract or pdf-parse.
 * @returns Array of partially-filled {@link ParsedKWTQuestion} objects.
 *   `correctAnswer` and answer lists are empty — users fill these in review.
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
 * @returns Array of line groups.
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
 * @param block - Lines belonging to one numbered question.
 * @returns Parsed question draft with empty answer arrays.
 */
function parseBlock(block: string[]): ParsedKWTQuestion {
  const firstMatch = block[0].match(QUESTION_START_RE);
  const afterNumber = firstMatch ? firstMatch[2] : block[0];

  const allLines = [afterNumber, ...block.slice(1)];

  let keyword = '';
  let sentence2WithGap = '';
  const sentence1Parts: string[] = [];

  for (const line of allLines) {
    if (!keyword && KEYWORD_RE.test(line)) {
      keyword = line.trim();
      continue;
    }
    if (!sentence2WithGap && GAP_RE.test(line)) {
      sentence2WithGap = line.replace(GAP_RE, CANONICAL_GAP).trim();
      continue;
    }
    if (!sentence2WithGap) {
      sentence1Parts.push(line);
    }
  }

  return {
    sentence1: sentence1Parts.join(' ').trim(),
    sentence2WithGap,
    keyword,
    correctAnswer: null,
    alternativeAnswers: [],
    exampleWrongAnswers: [],
    maxWords: 5,
  };
}