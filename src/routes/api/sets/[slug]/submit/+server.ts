import type {RequestHandler} from '@sveltejs/kit';
import {error, json} from '@sveltejs/kit';
import {db} from '$lib/server/db.js';
import {nanoid} from 'nanoid';

/** Row type for the set lookup query. */
type SetRow = { id: number };

/** Row type for the questions lookup query. */
type QRow = { id: number; correct_answer: string; alternative_answers: string };

/**
 * Maps contracted English forms to their expanded equivalents.
 * Applied to both stored answers and user input before comparison so that
 * "hadn't" and "had not" are treated as identical.
 */
const CONTRACTIONS: Record<string, string> = {
    "aren't": 'are not',
    "can't": 'cannot',
    "couldn't": 'could not',
    "didn't": 'did not',
    "doesn't": 'does not',
    "don't": 'do not',
    "hadn't": 'had not',
    "hasn't": 'has not',
    "haven't": 'have not',
    "he'd": 'he would',
    "he'll": 'he will',
    "he's": 'he is',
    "i'd": 'i would',
    "i'll": 'i will',
    "i'm": 'i am',
    "i've": 'i have',
    "isn't": 'is not',
    "it's": 'it is',
    "mustn't": 'must not',
    "needn't": 'need not',
    "shan't": 'shall not',
    "she'd": 'she would',
    "she'll": 'she will',
    "she's": 'she is',
    "shouldn't": 'should not',
    "that's": 'that is',
    "there's": 'there is',
    "they'd": 'they would',
    "they'll": 'they will',
    "they're": 'they are',
    "they've": 'they have',
    "wasn't": 'was not',
    "we'd": 'we would',
    "we're": 'we are',
    "we've": 'we have',
    "weren't": 'were not',
    "what's": 'what is',
    "who's": 'who is',
    "won't": 'will not',
    "wouldn't": 'would not',
    "you'd": 'you would',
    "you'll": 'you will',
    "you're": 'you are',
    "you've": 'you have',
};

/**
 * Expands English contractions to their full forms.
 *
 * @param s - Input string, already lowercased.
 * @returns String with contractions replaced by full forms.
 */
function expandContractions(s: string): string {
    return s.replace(/[\w']+/g, (word) => CONTRACTIONS[word] ?? word);
}

/**
 * Normalises a raw answer string for comparison.
 * Lowercases, expands contractions, trims, and collapses whitespace.
 *
 * @param s - Raw answer string.
 * @returns Normalised string ready for equality comparison.
 */
function normalise(s: string): string {
    return expandContractions(s.toLowerCase().trim().replace(/\s+/g, ' '));
}

export const POST: RequestHandler = async ({request, params}) => {
    const {slug} = params;

    const set = db
        .prepare('SELECT id FROM sets WHERE slug = ?')
        .get(slug!) as SetRow | undefined;

    if (!set) throw error(404, 'Set not found.');

    let body: { answers: Array<{ questionId: number; given: string }> };
    try {
        body = await request.json();
    } catch {
        throw error(400, 'Invalid JSON.');
    }

    if (!Array.isArray(body.answers) || body.answers.length === 0) {
        throw error(400, 'answers array required.');
    }

    const dbQuestions = db
        .prepare('SELECT id, correct_answer, alternative_answers FROM questions WHERE set_id = ?')
        .all(set.id) as QRow[];

    const qMap = new Map<number, QRow>(dbQuestions.map((q) => [q.id, q]));

    let score = 0;
    const graded: Array<{ questionId: number; given: string; isCorrect: boolean }> = [];

    for (const sub of body.answers) {
        const q = qMap.get(sub.questionId);
        if (!q) continue;

        const normGiven = normalise(sub.given ?? '');

        // Build the full set of accepted normalised answers.
        const alternatives: string[] = JSON.parse(q.alternative_answers || '[]');
        const acceptedNorm = [normalise(q.correct_answer), ...alternatives.map(normalise),];

        const isCorrect = normGiven.length > 0 && acceptedNorm.includes(normGiven);

        if (isCorrect) score++;
        graded.push({questionId: sub.questionId, given: sub.given?.trim() ?? '', isCorrect});
    }

    const total = graded.length;
    const attemptSlug = nanoid(10);

    db.transaction(() => {
        const r = db
            .prepare('INSERT INTO attempts (set_id, slug, score, total) VALUES (?, ?, ?, ?)')
            .run(set.id, attemptSlug, score, total);
        const attemptId = r.lastInsertRowid as number;

        const insertAnswer = db.prepare('INSERT INTO answers (attempt_id, question_id, given, is_correct) VALUES (?, ?, ?, ?)',);
        for (const g of graded) {
            insertAnswer.run(attemptId, g.questionId, g.given, g.isCorrect ? 1 : 0);
        }
    })();

    return json({attemptSlug, score, total});
};