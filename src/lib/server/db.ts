/**
 * @fileoverview SQLite database singleton with lazy initialisation.
 *
 * Uses better-sqlite3 which is fully compatible with Bun's Node.js runtime.
 * The data directory is resolved from the DATA_DIR env var (production) or
 * falls back to <cwd>/data (development).
 *
 * Why lazy initialisation:
 *   better-sqlite3 ships a native addon (.node binary) compiled for the
 *   deploy target (Linux ARM64 / Raspberry Pi). During `vite build` on
 *   Windows, SvelteKit evaluates the SSR bundle to extract route metadata,
 *   which would trigger `new Database()` and crash with ERR_DLOPEN_FAILED
 *   because the binary is not a valid Win32 application.
 *
 *   By deferring both the `require('better-sqlite3')` call and the
 *   `new Database()` call to the first actual DB access (i.e. the first
 *   incoming HTTP request on the server), the build phase completes cleanly
 *   without ever touching the native binary.
 *
 *   All existing call sites use `db.prepare(...)`, `db.exec(...)` etc. —
 *   the Proxy wrapper makes this transparent with no API changes required.
 */

import {mkdirSync} from 'fs';
import {join} from 'path';
import type DatabaseConstructor from 'better-sqlite3';
import { createRequire } from 'module';
type Database = ReturnType<typeof DatabaseConstructor>;

const DATA_DIR = process.env.DATA_DIR ?? join(process.cwd(), 'data');

let _db: Database | null = null;

/**
 * Opens the SQLite database connection on first call, then returns the cached
 * instance on every subsequent call.
 *
 * @returns The initialised better-sqlite3 Database instance.
 */
function openDb(): Database {
    if (_db) return _db;

    mkdirSync(DATA_DIR, {recursive: true});

    const Database = createRequire(import.meta.url)('better-sqlite3') as typeof DatabaseConstructor;

    _db = new Database(join(DATA_DIR, 'worksheet.db'));
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');

    _db.exec(`
        CREATE TABLE IF NOT EXISTS sets
        (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            slug         TEXT UNIQUE NOT NULL,
            title        TEXT        NOT NULL,
            source_label TEXT,
            created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS questions
        (
            id                    INTEGER PRIMARY KEY AUTOINCREMENT,
            set_id                INTEGER NOT NULL REFERENCES sets (id) ON DELETE CASCADE,
            position              INTEGER NOT NULL,
            sentence1             TEXT    NOT NULL,
            sentence2_with_gap    TEXT    NOT NULL,
            keyword               TEXT    NOT NULL,
            correct_answer        TEXT    NOT NULL,
            alternative_answers   TEXT    NOT NULL DEFAULT '[]',
            example_wrong_answers TEXT    NOT NULL DEFAULT '[]',
            max_words             INTEGER NOT NULL DEFAULT 5
        );

        CREATE TABLE IF NOT EXISTS attempts
        (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            set_id     INTEGER     NOT NULL REFERENCES sets (id),
            slug       TEXT UNIQUE NOT NULL,
            score      INTEGER     NOT NULL,
            total      INTEGER     NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS answers
        (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            attempt_id  INTEGER NOT NULL REFERENCES attempts (id) ON DELETE CASCADE,
            question_id INTEGER NOT NULL REFERENCES questions (id),
            given       TEXT,
            is_correct  INTEGER NOT NULL
        );
    `);

    // Safe migrations — SQLite does not support ADD COLUMN IF NOT EXISTS,
    // so we swallow the "duplicate column" error.
    const migrations = [
        `ALTER TABLE sets
            ADD COLUMN source_label TEXT`,
        `ALTER TABLE questions
            ADD COLUMN alternative_answers TEXT NOT NULL DEFAULT '[]'`,
        `ALTER TABLE questions
            ADD COLUMN example_wrong_answers TEXT NOT NULL DEFAULT '[]'`,
        `ALTER TABLE sets
            ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0`,
        `ALTER TABLE sets
            ADD COLUMN parent_slug TEXT`,
        `ALTER TABLE questions
            ADD COLUMN min_words INTEGER NOT NULL DEFAULT 2`,
        `ALTER TABLE sets
            ADD COLUMN type TEXT NOT NULL DEFAULT 'kwt'`,
    ];

    for (const stmt of migrations) {
        try {
            _db.exec(stmt);
        } catch {
            // Column already exists — safe to ignore.
        }
    }

    return _db;
}

/**
 * Proxy that exposes the Database API while deferring the actual connection
 * until the first method call. All existing `db.prepare(...)`, `db.exec(...)`
 * etc. call sites work without modification.
 */
export const db = new Proxy({} as Database, {
    get(_target, prop: string | symbol) {
        return Reflect.get(openDb(), prop);
    },
    set(_target, prop: string | symbol, value) {
        return Reflect.set(openDb(), prop, value);
    },
});