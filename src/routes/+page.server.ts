import type { PageServerLoad } from './$types.js';
import { db } from '$lib/server/db.js';
import type { SetSummary } from '$lib/types.js';

type SetRow = {
  slug: string;
  title: string;
  source_label: string | null;
  created_at: string;
  question_count: number;
};

export const load: PageServerLoad = () => {
  const rows = db.prepare(`
    SELECT s.slug,
           s.title,
           s.source_label,
           s.created_at,
           COUNT(q.id) AS question_count
    FROM sets s
    LEFT JOIN questions q ON q.set_id = s.id
    GROUP BY s.id
    ORDER BY s.source_label ASC, s.created_at DESC
  `).all() as SetRow[];

  const sets: SetSummary[] = rows.map((r) => ({
    slug: r.slug,
    title: r.title,
    sourceLabel: r.source_label,
    questionCount: r.question_count,
    createdAt: r.created_at,
  }));

  return { sets };
};