import type {RequestHandler} from '@sveltejs/kit';
import {error, json} from '@sveltejs/kit';
import {db} from '$lib/server/db.js';
import {nanoid} from 'nanoid';

interface QuestionInput {
    sentence1: string;
    sentence2WithGap: string;
    keyword: string;
    correctAnswer: string;
    alternativeAnswers?: string[];
    exampleWrongAnswers?: string[];
    maxWords: 3 | 4 | 5;
}

export const POST: RequestHandler = async ({request}) => {
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
        if (![3, 4, 5].includes(q.maxWords)) throw error(400, `Q${i + 1}: maxWords must be 3, 4, or 5.`);
    }

    const slug = nanoid(8);

    db.transaction(() => {
        const setResult = db
            .prepare('INSERT INTO sets (slug, title, source_label) VALUES (?, ?, ?)')
            .run(slug, title.trim(), sourceLabel?.trim() || null);
        const setId = setResult.lastInsertRowid as number;

        const insertQuestion = db.prepare(`
            INSERT INTO questions
            (set_id, position, sentence1, sentence2_with_gap, keyword,
             correct_answer, alternative_answers, example_wrong_answers, max_words)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const [i, q] of questions.entries()) {
            insertQuestion.run(setId, i + 1, q.sentence1.trim(), q.sentence2WithGap.trim(), q.keyword.trim().toUpperCase(), q.correctAnswer.trim(), JSON.stringify((q.alternativeAnswers ?? []).map((a) => a.trim()).filter(Boolean)), JSON.stringify((q.exampleWrongAnswers ?? []).map((a) => a.trim()).filter(Boolean)), q.maxWords,);
        }
    })();

    return json({slug});
};