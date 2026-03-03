import Database from 'better-sqlite3';
import {mkdirSync} from 'fs';
import {join} from 'path';

const DATA_DIR = join(process.cwd(), 'data');
mkdirSync(DATA_DIR, {recursive: true});

export const db = new Database(join(DATA_DIR, 'worksheet.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
    CREATE TABLE IF NOT EXISTS sets
    (
        id
            INTEGER
            PRIMARY
                KEY
            AUTOINCREMENT,
        slug
            TEXT
            UNIQUE
            NOT
                NULL,
        title
            TEXT
            NOT
                NULL,
        source_label
            TEXT,
        created_at
            DATETIME
            DEFAULT
                CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS questions
    (
        id
                              INTEGER
            PRIMARY
                KEY
            AUTOINCREMENT,
        set_id
                              INTEGER
                                      NOT
                                          NULL
            REFERENCES
                sets
                    (
                     id
                        ) ON DELETE CASCADE,
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
        id
                   INTEGER
            PRIMARY
                KEY
            AUTOINCREMENT,
        set_id
                   INTEGER
                               NOT
                                   NULL
            REFERENCES
                sets
                    (
                     id
                        ),
        slug       TEXT UNIQUE NOT NULL,
        score      INTEGER     NOT NULL,
        total      INTEGER     NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS answers
    (
        id
                    INTEGER
            PRIMARY
                KEY
            AUTOINCREMENT,
        attempt_id
                    INTEGER
                            NOT
                                NULL
            REFERENCES
                attempts
                    (
                     id
                        ) ON DELETE CASCADE,
        question_id INTEGER NOT NULL REFERENCES questions
            (
             id
                ),
        given       TEXT,
        is_correct  INTEGER NOT NULL
    );
`);

// Safe migrations for existing databases — SQLite does not support
// ADD COLUMN IF NOT EXISTS, so we catch the duplicate-column error.
const migrations = [
    `ALTER TABLE sets ADD COLUMN source_label TEXT`,
    `ALTER TABLE questions ADD COLUMN alternative_answers TEXT NOT NULL DEFAULT '[]'`,
    `ALTER TABLE questions ADD COLUMN example_wrong_answers TEXT NOT NULL DEFAULT '[]'`,
    `ALTER TABLE sets ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0`,
    // Tracks the original set this one was forked from (user "Edit" flow).
    // NULL means the set was created from scratch or is an original.
    `ALTER TABLE sets ADD COLUMN parent_slug TEXT`,
];

for (const stmt of migrations) {
    try {
        db.exec(stmt);
    } catch {
        // Column already exists — safe to ignore.
    }
}