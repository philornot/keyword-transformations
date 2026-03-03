import type {RequestHandler} from '@sveltejs/kit';
import {error, json} from '@sveltejs/kit';
import {db} from '$lib/server/db.js';
import {nanoid} from 'nanoid';
import {env} from '$env/dynamic/private';

const ADMIN_COOKIE = 'kwt_admin';

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

export const POST: RequestHandler = async ({request, cookies}) => {
    let body: { title: string; sourceLabel?: string; questions: QuestionInput[] };
    try {
        body = await request.json();
    } catch {
        throw error(400, 'Invalid JSON.');
    }

    const {title, sourceLabel, questions} = body;

    if (!title?.trim()) throw error(400, 'title is required.');
    if (!Array.isArray(questions) || questions.length === 0) {
        throw error(400, 'At least one question is required.');
    }

    for (const [i, q] of questions.entries()) {
        if (!q.sentence1?.trim()) throw error(400, `Q${i + 1}: sentence1 required.`);
        if (!q.sentence2WithGap?.includes('______')) throw error(400, `Q${i + 1}: sentence2WithGap must contain ______.`);
        if (!q.keyword?.trim()) throw error(400, `Q${i + 1}: keyword required.`);
        if (!q.correctAnswer?.trim()) throw error(400, `Q${i + 1}: correctAnswer required.`);

        const maxWords = q.maxWords ?? 0;
        if (!Number.isInteger(maxWords) || maxWords < 0 || maxWords > 20) {
            throw error(400, `Q${i + 1}: maxWords must be an integer between 0 and 20 (0 = no limit).`);
        }

        const minWords = q.minWords ?? 0;
        if (!Number.isInteger(minWords) || minWords < 0 || (maxWords > 0 && minWords > maxWords)) {
            throw error(400, `Q${i + 1}: minWords must be between 0 and maxWords.`);
        }
    }

    const isAdmin = !!env.ADMIN_PASSWORD && cookies.get(ADMIN_COOKIE) === env.ADMIN_PASSWORD;

    const slug = nanoid(8);

    db.transaction(() => {
        const setResult = db
            .prepare('INSERT INTO sets (slug, title, source_label, is_public) VALUES (?, ?, ?, ?)')
            .run(slug, title.trim(), sourceLabel?.trim() || null, isAdmin ? 1 : 0);

        const setId = setResult.lastInsertRowid as number;

        const insertQuestion = db.prepare(`
            INSERT INTO questions
            (set_id, position, sentence1, sentence2_with_gap, keyword,
             correct_answer, alternative_answers, example_wrong_answers, min_words, max_words)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const [i, q] of questions.entries()) {
            insertQuestion.run(setId, i + 1, q.sentence1.trim(), q.sentence2WithGap.trim(), q.keyword.trim().toUpperCase(), q.correctAnswer.trim(), JSON.stringify((q.alternativeAnswers ?? []).map((a) => a.trim()).filter(Boolean)), JSON.stringify((q.exampleWrongAnswers ?? []).map((a) => a.trim()).filter(Boolean)), q.minWords ?? 0, q.maxWords ?? 0,);
        }
    })();

    return json({slug});
};