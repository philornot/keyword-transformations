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

/**
 * Expands an answer that contains parenthesised optional segments into all
 * valid variants. Parentheses may appear anywhere in the string and may be
 * nested at one level.
 *
 * Examples:
 *   "so noisy outside (that)"   → ["so noisy outside that", "so noisy outside"]
 *   "(very) noisy outside"      → ["very noisy outside", "noisy outside"]
 *   "so (very) noisy (that)"    → ["so very noisy that", "so very noisy",
 *                                   "so noisy that", "so noisy"]
 *   "had not been"              → ["had not been"]  (no parens → passthrough)
 *
 * The function generates the Cartesian product of including/excluding each
 * parenthesised group, then normalises and deduplicates the results.
 *
 * @param raw - A single answer string, possibly containing `(…)` groups.
 * @returns Array of one or more normalised variant strings.
 */
function expandOptionals(raw: string): string[] {
    // Find all parenthesised groups with their positions.
    const groups: Array<{ start: number; end: number; inner: string }> = [];
    const re = /\(([^)]*)\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) {
        groups.push({start: m.index, end: m.index + m[0].length, inner: m[1]});
    }

    if (groups.length === 0) return [normalise(raw)];

    // Generate 2^n variants by toggling each group (include inner / exclude).
    const variants = new Set<string>();
    const count = 2 ** groups.length;

    for (let mask = 0; mask < count; mask++) {
        let result = '';
        let cursor = 0;

        for (let gi = 0; gi < groups.length; gi++) {
            const g = groups[gi];
            // Text before this group.
            result += raw.slice(cursor, g.start);
            // Bit gi set → include the inner text; unset → omit entirely.
            if (mask & (1 << gi)) {
                result += g.inner;
            }
            cursor = g.end;
        }
        // Remaining text after the last group.
        result += raw.slice(cursor);

        // Collapse extra whitespace that can appear when an optional group is
        // omitted (e.g. "outside  that" → "outside that").
        const normalised = normalise(result.replace(/\s{2,}/g, ' '));
        if (normalised) variants.add(normalised);
    }

    return Array.from(variants);
}

/**
 * Builds the full set of normalised accepted answers for a question,
 * expanding any parenthesised optional segments in every stored answer.
 *
 * @param correctAnswer - The primary correct answer string.
 * @param alternativeAnswers - Additional accepted answer strings.
 * @returns Deduplicated array of normalised strings ready for comparison.
 */
function buildAcceptedSet(correctAnswer: string, alternativeAnswers: string[]): string[] {
    const all = [correctAnswer, ...alternativeAnswers];
    const expanded = all.flatMap(expandOptionals);
    return [...new Set(expanded)];
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
        const alternatives: string[] = JSON.parse(q.alternative_answers || '[]');
        const acceptedNorm = buildAcceptedSet(q.correct_answer, alternatives);

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