import type {Actions, PageServerLoad} from './$types.js';
import type {Cookies} from '@sveltejs/kit';
import {error, fail, redirect} from '@sveltejs/kit';
import {db} from '$lib/server/db.js';
import type {SetSummary} from '$lib/types.js';
import {env} from '$env/dynamic/private';

const PASSWORD = env.ADMIN_PASSWORD;
const COOKIE = 'kwt_admin';

/**
 * Checks whether the incoming request carries a valid admin session cookie.
 *
 * @param cookies - SvelteKit cookies handle.
 * @returns True if the session cookie matches the configured password.
 */
function isAuthenticated(cookies: Cookies): boolean {
    if (!PASSWORD) return false;
    return cookies.get(COOKIE) === PASSWORD;
}

type SetRow = {
    slug: string; title: string; source_label: string | null; created_at: string; question_count: number;
};

export const load: PageServerLoad = ({cookies}) => {
    if (!PASSWORD) throw error(503, 'Admin access is not configured (ADMIN_PASSWORD not set).');

    const authenticated = isAuthenticated(cookies);

    if (!authenticated) {
        return {authenticated: false, sets: [] as SetSummary[]};
    }

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

    return {authenticated: true, sets};
};

export const actions: Actions = {

    /**
     * Validates the submitted password and sets a session cookie on success.
     */
    login: async ({request, cookies}: { request: Request; cookies: Cookies }) => {
        const data = await request.formData();
        const password = data.get('password')?.toString() ?? '';

        if (password !== PASSWORD) {
            return fail(401, {loginError: 'Nieprawidłowe hasło.'});
        }

        cookies.set(COOKIE, PASSWORD!, {
            path: '/', httpOnly: true, sameSite: 'strict', maxAge: 60 * 60 * 8,
        });

        redirect(303, '/admin');
    },

    /**
     * Deletes a set and all its questions, attempts and answers (CASCADE).
     * Requires an active admin session.
     */
    deleteSet: async ({request, cookies}: { request: Request; cookies: Cookies }) => {
        if (!isAuthenticated(cookies)) return fail(403, {error: 'Unauthorized.'});

        const data = await request.formData();
        const slug = data.get('slug')?.toString() ?? '';

        if (!slug) return fail(400, {error: 'Missing slug.'});

        db.prepare('DELETE FROM sets WHERE slug = ?').run(slug);

        return {deleted: slug};
    },

    /**
     * Clears the admin session cookie, logging the user out.
     */
    logout: async ({cookies}: { cookies: Cookies }) => {
        cookies.delete(COOKIE, {path: '/'});
        redirect(303, '/admin');
    },
};