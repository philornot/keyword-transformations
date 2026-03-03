/**
 * @fileoverview REST handlers for a single named set.
 *
 * GET  /api/sets/[slug]  — Returns the full set with all question fields
 *                          needed by the editor (correct answers included).
 *                          Requires an active admin session.
 *
 * PUT  /api/sets/[slug]  — Two behaviours depending on the caller:
 *
 *   Admin session present → in-place update. The set keeps its slug,
 *   title, questions are replaced, attempts remain untouched.
 *
 *   No admin session → user fork. A new set is created (new slug).
 *   If the new content is byte-for-byte identical to the source set the
 *   fork is discarded and the original slug is returned unchanged.
 */

import type {RequestHandler} from '@sveltejs/kit';
import {error, json} from '@sveltejs/kit';
import {db} from '$lib/server/db.js';
import {nanoid} from 'nanoid';
// @ts-ignore
import {env} from '$env/dynamic/private';

const ADMIN_COOKIE = 'kwt_admin';

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

interface QuestionInput {
    sentence1: string;
    sentence2WithGap: string;
    keyword: string;
    correctAnswer: string;
    alternativeAnswers?: string[];
    exampleWrongAnswers?: string[];
    /** Minimum word count; 0 means no minimum enforced. */
    minWords?: number;
    /** Maximum word count; 0 means no maximum enforced. */
    maxWords: number;
}

interface PutBody {
    title: string;
    sourceLabel?: string;
    questions: QuestionInput[];
}

type SetRow = {
    id: number; slug: string; title: string; source_label: string | null; is_public: number; parent_slug: string | null;
};

type QRow = {
    id: number;
    position: number;
    sentence1: string;
    sentence2_with_gap: string;
    keyword: string;
    correct_answer: string;
    alternative_answers: string;
    example_wrong_answers: string;
    min_words: number;
    max_words: number;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Validates a single question input object.
 *
 * `maxWords = 0` is valid and means "no word-count limit". When a limit is
 * set, `minWords` must be ≤ `maxWords`.
 *
 * @param q - The question payload from the request body.
 * @param index - Zero-based position (used in error messages).
 * @throws {HttpError} 400 if any required field is missing or invalid.
 */
function validateQuestion(q: QuestionInput, index: number): void {
    if (!q.sentence1?.trim()) throw error(400, `Q${index + 1}: sentence1 required.`);
    if (!q.sentence2WithGap?.includes('______')) throw error(400, `Q${index + 1}: sentence2WithGap must contain ______.`);
    if (!q.keyword?.trim()) throw error(400, `Q${index + 1}: keyword required.`);
    if (!q.correctAnswer?.trim()) throw error(400, `Q${index + 1}: correctAnswer required.`);

    const maxWords = q.maxWords ?? 0;
    if (!Number.isInteger(maxWords) || maxWords < 0 || maxWords > 20) {
        throw error(400, `Q${index + 1}: maxWords must be an integer 0–20 (0 = no limit).`);
    }

    const minWords = q.minWords ?? 0;
    if (!Number.isInteger(minWords) || minWords < 0 || (maxWords > 0 && minWords > maxWords)) {
        throw error(400, `Q${index + 1}: minWords must be 0–maxWords.`);
    }
}

/**
 * Inserts all questions for a given set id inside the caller's transaction.
 *
 * @param setId - The database id of the parent set.
 * @param questions - Validated question payloads.
 */
function insertQuestions(setId: number, questions: QuestionInput[]): void {
    const stmt = db.prepare(`
        INSERT INTO questions
        (set_id, position, sentence1, sentence2_with_gap, keyword,
         correct_answer, alternative_answers, example_wrong_answers, min_words, max_words)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const [i, q] of questions.entries()) {
        stmt.run(setId, i + 1, q.sentence1.trim(), q.sentence2WithGap.trim(), q.keyword.trim().toUpperCase(), q.correctAnswer.trim(), JSON.stringify((q.alternativeAnswers ?? []).map((a) => a.trim()).filter(Boolean)), JSON.stringify((q.exampleWrongAnswers ?? []).map((a) => a.trim()).filter(Boolean)), q.minWords ?? 0, q.maxWords ?? 0,);
    }
}

/**
 * Produces a deterministic string fingerprint of a set's content.
 * Used to decide whether a user fork is truly different from its source.
 *
 * @param title - Set title.
 * @param sourceLabel - Optional source label.
 * @param questions - Question payloads.
 * @returns JSON string suitable for equality comparison.
 */
function fingerprint(title: string, sourceLabel: string | undefined, questions: QuestionInput[]): string {
    return JSON.stringify({
        title: title.trim(), sourceLabel: sourceLabel?.trim() ?? '', questions: questions.map((q) => ({
            sentence1: q.sentence1.trim(),
            sentence2WithGap: q.sentence2WithGap.trim(),
            keyword: q.keyword.trim().toUpperCase(),
            correctAnswer: q.correctAnswer.trim(),
            alternativeAnswers: (q.alternativeAnswers ?? []).map((a) => a.trim()).filter(Boolean).sort(),
            exampleWrongAnswers: (q.exampleWrongAnswers ?? []).map((a) => a.trim()).filter(Boolean).sort(),
            minWords: q.minWords ?? 0,
            maxWords: q.maxWords ?? 0,
        })),
    });
}

/**
 * Builds the fingerprint of a set currently stored in the database.
 *
 * @param setRow - The set metadata row.
 * @param qRows - The question rows for this set.
 * @returns JSON fingerprint string.
 */
function fingerprintFromDb(setRow: SetRow, qRows: QRow[]): string {
    return JSON.stringify({
        title: setRow.title, sourceLabel: setRow.source_label ?? '', questions: qRows.map((r) => ({
            sentence1: r.sentence1,
            sentence2WithGap: r.sentence2_with_gap,
            keyword: r.keyword,
            correctAnswer: r.correct_answer,
            alternativeAnswers: (JSON.parse(r.alternative_answers || '[]') as string[]).sort(),
            exampleWrongAnswers: (JSON.parse(r.example_wrong_answers || '[]') as string[]).sort(),
            minWords: r.min_words,
            maxWords: r.max_words,
        })),
    });
}

// ---------------------------------------------------------------------------
// GET /api/sets/[slug]
// ---------------------------------------------------------------------------

/**
 * Returns the full set (including correct answers) for the edit page.
 * Only accessible with a valid admin session.
 */
export const GET: RequestHandler = ({params, cookies}) => {
    const isAdmin = !!env.ADMIN_PASSWORD && cookies.get(ADMIN_COOKIE) === env.ADMIN_PASSWORD;
    if (!isAdmin) throw error(403, 'Admin access required.');

    const set = db
        .prepare('SELECT id, slug, title, source_label, is_public, parent_slug FROM sets WHERE slug = ?')
        .get(params.slug!) as SetRow | undefined;

    if (!set) throw error(404, 'Set not found.');

    const qRows = db
        .prepare(`
            SELECT id,
                   position,
                   sentence1,
                   sentence2_with_gap,
                   keyword,
                   correct_answer,
                   alternative_answers,
                   example_wrong_answers,
                   min_words,
                   max_words
            FROM questions
            WHERE set_id = ?
            ORDER BY position
        `)
        .all(set.id) as QRow[];

    return json({
        id: set.id,
        slug: set.slug,
        title: set.title,
        sourceLabel: set.source_label,
        isPublic: set.is_public === 1,
        questions: qRows.map((r) => ({
            id: r.id,
            position: r.position,
            sentence1: r.sentence1,
            sentence2WithGap: r.sentence2_with_gap,
            keyword: r.keyword,
            correctAnswer: r.correct_answer,
            alternativeAnswers: JSON.parse(r.alternative_answers || '[]'),
            exampleWrongAnswers: JSON.parse(r.example_wrong_answers || '[]'),
            minWords: r.min_words,
            maxWords: r.max_words,
        })),
    });
};

// ---------------------------------------------------------------------------
// PUT /api/sets/[slug]
// ---------------------------------------------------------------------------

/**
 * Updates an existing set in-place (admin) or creates a user fork (no session).
 *
 * Admin path  → replaces questions for the existing slug; returns { slug }.
 * User path   → creates a new set derived from the original:
 *                 - If content is identical to the source → { slug, isNew: false }.
 *                 - Otherwise → saves new set, returns { slug, isNew: true }.
 */
export const PUT: RequestHandler = async ({request, params, cookies}) => {
    const isAdmin = !!env.ADMIN_PASSWORD && cookies.get(ADMIN_COOKIE) === env.ADMIN_PASSWORD;

    let body: PutBody;
    try {
        body = await request.json();
    } catch {
        throw error(400, 'Invalid JSON.');
    }

    const {title, sourceLabel, questions} = body;

    if (!title?.trim()) throw error(400, 'title is required.');
    if (!Array.isArray(questions) || questions.length === 0) throw error(400, 'At least one question is required.');

    for (const [i, q] of questions.entries()) validateQuestion(q, i);

    const sourceSet = db
        .prepare('SELECT id, slug, title, source_label, is_public, parent_slug FROM sets WHERE slug = ?')
        .get(params.slug!) as SetRow | undefined;

    if (!sourceSet) throw error(404, 'Set not found.');

    // ── Admin: in-place update ──────────────────────────────────────────
    if (isAdmin) {
        db.transaction(() => {
            db.prepare('UPDATE sets SET title = ?, source_label = ? WHERE id = ?')
                .run(title.trim(), sourceLabel?.trim() || null, sourceSet.id);

            const questionIds = (db.prepare('SELECT id FROM questions WHERE set_id = ?').all(sourceSet.id) as {
                id: number
            }[]).map((r) => r.id);

            if (questionIds.length > 0) {
                const placeholders = questionIds.map(() => '?').join(', ');
                db.prepare(`DELETE
                            FROM answers
                            WHERE question_id IN (${placeholders})`)
                    .run(...questionIds);
            }

            db.prepare('DELETE FROM questions WHERE set_id = ?').run(sourceSet.id);
            insertQuestions(sourceSet.id, questions);
        })();

        return json({slug: sourceSet.slug});
    }

    // ── User fork ───────────────────────────────────────────────────────
    const originSlug = sourceSet.parent_slug ?? sourceSet.slug;
    const originSet = db
        .prepare('SELECT id, slug, title, source_label, is_public, parent_slug FROM sets WHERE slug = ?')
        .get(originSlug) as SetRow | undefined;

    if (originSet) {
        const originQRows = db
            .prepare('SELECT * FROM questions WHERE set_id = ? ORDER BY position')
            .all(originSet.id) as QRow[];

        if (fingerprint(title, sourceLabel, questions) === fingerprintFromDb(originSet, originQRows)) {
            return json({slug: originSet.slug, isNew: false});
        }
    }

    const newSlug = nanoid(8);

    db.transaction(() => {
        const result = db
            .prepare('INSERT INTO sets (slug, title, source_label, is_public, parent_slug) VALUES (?, ?, ?, 0, ?)')
            .run(newSlug, title.trim(), sourceLabel?.trim() || null, originSlug);

        insertQuestions(result.lastInsertRowid as number, questions);
    })();

    return json({slug: newSlug, isNew: true}, {status: 201});
};