/**
 * @fileoverview Shared type definitions for Key Word Transformation exercises.
 */

/**
 * A single KWT question as returned from the OCR/parse pipeline,
 * before it is saved to the database.
 */
export interface ParsedKWTQuestion {
    /** Full original sentence (the "stem"). */
    sentence1: string;
    /** Second sentence containing `______` as the gap placeholder. */
    sentence2WithGap: string;
    /** The key word, written in uppercase. */
    keyword: string;
    /** The primary correct answer. Null until set by user. */
    correctAnswer: string | null;
    /** Additional accepted answers (e.g. contraction variants, CKE alternates). */
    alternativeAnswers: string[];
    /**
     * Answers that are definitively wrong and used to generate specific
     * feedback in the result view (e.g. CKE-published incorrect examples).
     */
    exampleWrongAnswers: string[];
    /** Maximum number of words allowed (typically 3, 4, or 5). */
    maxWords: 3 | 4 | 5;
}

/** A persisted KWT question loaded from the database. */
export interface KWTQuestion {
    id: number;
    position: number;
    sentence1: string;
    sentence2WithGap: string;
    keyword: string;
    correctAnswer: string;
    alternativeAnswers: string[];
    exampleWrongAnswers: string[];
    maxWords: 3 | 4 | 5;
}

/** A question sent to the browser for test-taking (no answers). */
export interface PublicKWTQuestion {
    id: number;
    position: number;
    sentence1: string;
    sentence2WithGap: string;
    keyword: string;
    maxWords: 3 | 4 | 5;
}

/** A set as sent to the browser. */
export interface PublicSet {
    id: number;
    slug: string;
    title: string;
    sourceLabel: string | null;
    questions: PublicKWTQuestion[];
}

/** Summary row used on the home page set listing. */
export interface SetSummary {
    slug: string;
    title: string;
    sourceLabel: string | null;
    questionCount: number;
    createdAt: string;
}

/** A single submitted answer from the test-taker. */
export interface SubmittedAnswer {
    questionId: number;
    given: string;
}

/** One graded answer in the attempt result. */
export interface AnswerResult {
    questionId: number;
    position: number;
    sentence1: string;
    sentence2WithGap: string;
    keyword: string;
    given: string | null;
    correctAnswer: string;
    alternativeAnswers: string[];
    isCorrect: boolean;
    /** True when `given` exactly matches one of the teacher-supplied wrong examples. */
    isKnownWrongAnswer: boolean;
}

/** Full attempt result returned after grading. */
export interface AttemptResult {
    attemptSlug: string;
    setSlug: string;
    setTitle: string;
    score: number;
    total: number;
    percentage: number;
    answers: AnswerResult[];
}

/** Response from the /api/upload endpoint. */
export interface UploadResponse {
    questions: ParsedKWTQuestion[];
    rawText: string;
}