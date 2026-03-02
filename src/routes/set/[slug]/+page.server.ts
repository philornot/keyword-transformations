import type {PageServerLoad} from './$types.js';
import {db} from '$lib/server/db.js';
import {error} from '@sveltejs/kit';
import type {PublicSet} from '$lib/types.js';

export const load: PageServerLoad = ({params}) => {
    const set = db
        .prepare('SELECT id, title, source_label FROM sets WHERE slug = ?')
        .get(params.slug) as { id: number; title: string; source_label: string | null } | undefined;

    if (!set) throw error(404, 'Set not found.');

    type QRow = {
        id: number; position: number; sentence1: string; sentence2_with_gap: string; keyword: string; max_words: number;
    };

    const rows = db.prepare(`
        SELECT id, position, sentence1, sentence2_with_gap, keyword, max_words
        FROM questions
        WHERE set_id = ?
        ORDER BY position
    `).all(set.id) as QRow[];

    const publicSet: PublicSet = {
        id: set.id, slug: params.slug, title: set.title, sourceLabel: set.source_label, questions: rows.map((r) => ({
            id: r.id,
            position: r.position,
            sentence1: r.sentence1,
            sentence2WithGap: r.sentence2_with_gap,
            keyword: r.keyword,
            maxWords: r.max_words as 3 | 4 | 5,
        })),
    };

    return {set: publicSet};
};