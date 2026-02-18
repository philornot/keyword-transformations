/**
 * @fileoverview Simple reactive i18n for Polish (default) and English.
 *
 * Uses a Svelte 5 module-level $state so the locale persists across
 * navigation without any server round-trip. The `t()` function reads
 * `locale.lang` which is reactive — calling it from a Svelte template
 * or a $derived block re-runs automatically on language change.
 */

export const locale = $state<{ lang: 'pl' | 'en' }>({lang: 'pl'});

const pl = {
    nav: {
        home: 'Keyword Transformations', scan: 'Zeskanuj zadania', manual: 'Utwórz zestaw',
    }, home: {
        title: 'Zamień kartkę z ćwiczeniami w interaktywny test',
        subtitle: 'Wgraj zdjęcie lub PDF kartki, a system automatycznie wykryje transformacje słów kluczowych. Popraw wynik i udostępnij link.',
        scanTitle: 'Zeskanuj zadania',
        scanDesc: 'Wgraj zdjęcie lub PDF — OCR wykryje pytania automatycznie.',
        manualTitle: 'Utwórz ręcznie',
        manualDesc: 'Twórz transformacje słów kluczowych krok po kroku bez skanowania.',
        step1: 'Wgraj',
        step1desc: 'Zrób zdjęcie lub wgraj PDF z arkuszem ćwiczeń.',
        step2: 'Sprawdź',
        step2desc: 'Popraw automatycznie wykryte pytania i uzupełnij odpowiedzi.',
        step3: 'Udostępnij',
        step3desc: 'Opublikuj i wyślij link — każdy może rozwiązać test w przeglądarce.',
    }, scan: {
        title: 'Zeskanuj kartkę',
        subtitle: 'Obsługiwane formaty: JPEG, PNG, WEBP, PDF — maks. 20 MB',
        dropHint: 'Przeciągnij plik tutaj',
        or: 'lub',
        browse: 'Wybierz plik',
        process: 'Wykryj pytania',
        processing: 'Przetwarzanie… (OCR może potrwać do 30 s)',
        errorType: 'Nieobsługiwany format. Użyj JPEG, PNG, WEBP lub PDF.',
        errorSize: 'Plik jest za duży. Maksymalny rozmiar to 20 MB.',
        removeFile: 'Usuń plik',
    }, review: {
        title: 'Sprawdź pytania',
        subtitle: '{n} pytań wykrytych — popraw błędy i uzupełnij poprawne odpowiedzi.',
        setTitle: 'Tytuł zestawu',
        setTitlePlaceholder: 'np. Transformacje – Unit 5',
        publish: 'Opublikuj zestaw',
        publishing: 'Publikowanie…',
        addQuestion: 'Dodaj pytanie',
        sentence1: 'Zdanie oryginalne',
        sentence1ph: 'Wpisz pełne zdanie…',
        sentence2: 'Zdanie z luką (użyj ______ jako luki)',
        sentence2ph: 'np. It wasn\'t until Monday ______ the news.',
        keyword: 'Keyword',
        keywordph: 'np. UNTIL',
        answer: 'Poprawna odpowiedź',
        answerph: 'Wpisz frazę wypełniającą lukę…',
        maxWords: 'Maks. wyrazów',
        errSentence1: 'Zdanie oryginalne jest wymagane.',
        errSentence2: 'Zdanie z luką jest wymagane i musi zawierać ______.',
        errKeyword: 'Keyword jest wymagany.',
        errAnswer: 'Poprawna odpowiedź jest wymagana.',
        questionNum: 'Pytanie #{n}',
    }, manual: {
        title: 'Nowy zestaw — transformacje',
        subtitle: 'Utwórz zestaw ćwiczeń Key Word Transformation bez skanowania.',
        setTitle: 'Tytuł zestawu',
        setTitlePlaceholder: 'np. FCE Transformacje – Czas przeszły',
        publish: 'Opublikuj zestaw',
        publishing: 'Publikowanie…',
        addQuestion: 'Dodaj transformację',
        empty: 'Brak pytań. Kliknij „Dodaj transformację" poniżej.',
    }, set: {
        questions: '{n} pytań',
        submit: 'Sprawdź odpowiedzi',
        submitting: 'Sprawdzanie…',
        unanswered: 'Pozostało bez odpowiedzi: {n}',
        keyword: 'Keyword:',
        maxWords: 'Maks. {n} wyrazów',
        gapPlaceholder: 'wpisz odpowiedź…',
        sentence2label: 'Uzupełnij:',
    }, result: {
        title: 'Wyniki — {title}',
        breakdown: 'Szczegóły odpowiedzi',
        back: 'Powrót do strony głównej',
        perfect: 'Idealny wynik!',
        great: 'Świetnie!',
        good: 'Niezły wynik — ćwicz dalej!',
        poor: 'Nie poddawaj się — ucz się dalej!',
        yourAnswer: 'Twoja odpowiedź:',
        correct: 'Poprawna:',
        noAnswer: '(brak odpowiedzi)',
    }, common: {
        remove: 'Usuń', words3: '3 wyrazy', words4: '4 wyrazy', words5: '5 wyrazów', langToggle: 'EN',
    },
};

const en: typeof pl = {
    nav: {
        home: 'Keyword Transformations', scan: 'Scan worksheet', manual: 'Create set',
    }, home: {
        title: 'Turn a paper worksheet into an interactive test',
        subtitle: 'Upload a photo or PDF of your worksheet and the app auto-detects key word transformation exercises. Review, publish, share.',
        scanTitle: 'Scan worksheet',
        scanDesc: 'Upload a photo or PDF — OCR detects questions automatically.',
        manualTitle: 'Create manually',
        manualDesc: 'Build key word transformation exercises step by step, no scanning needed.',
        step1: 'Upload',
        step1desc: 'Take a photo or upload a PDF of your exercise sheet.',
        step2: 'Review',
        step2desc: 'Correct auto-detected questions and fill in the correct answers.',
        step3: 'Share',
        step3desc: 'Publish and send the link — anyone can take the test in their browser.',
    }, scan: {
        title: 'Scan worksheet',
        subtitle: 'Supported formats: JPEG, PNG, WEBP, PDF — max 20 MB',
        dropHint: 'Drag & drop your file here',
        or: 'or',
        browse: 'Browse files',
        process: 'Detect questions',
        processing: 'Processing… (OCR can take up to 30 s)',
        errorType: 'Unsupported file type. Use JPEG, PNG, WEBP, or PDF.',
        errorSize: 'File too large. Maximum size is 20 MB.',
        removeFile: 'Remove file',
    }, review: {
        title: 'Review questions',
        subtitle: '{n} questions detected — fix any mistakes and fill in correct answers.',
        setTitle: 'Set title',
        setTitlePlaceholder: 'e.g. Unit 5 Key Word Transformations',
        publish: 'Publish set',
        publishing: 'Publishing…',
        addQuestion: 'Add question',
        sentence1: 'Original sentence',
        sentence1ph: 'Type the full original sentence…',
        sentence2: 'Gapped sentence (use ______ for the gap)',
        sentence2ph: "e.g. It wasn't until Monday ______ the news.",
        keyword: 'Keyword',
        keywordph: 'e.g. UNTIL',
        answer: 'Correct answer',
        answerph: 'Type the phrase that fills the gap…',
        maxWords: 'Max words',
        errSentence1: 'Original sentence is required.',
        errSentence2: 'Gapped sentence is required and must contain ______.',
        errKeyword: 'Keyword is required.',
        errAnswer: 'Correct answer is required.',
        questionNum: 'Question #{n}',
    }, manual: {
        title: 'New set — transformations',
        subtitle: 'Create a Key Word Transformation set without scanning.',
        setTitle: 'Set title',
        setTitlePlaceholder: 'e.g. FCE Transformations – Past Tenses',
        publish: 'Publish set',
        publishing: 'Publishing…',
        addQuestion: 'Add transformation',
        empty: 'No questions yet. Click "Add transformation" below.',
    }, set: {
        questions: '{n} questions',
        submit: 'Submit answers',
        submitting: 'Checking…',
        unanswered: 'Unanswered: {n}',
        keyword: 'Keyword:',
        maxWords: 'Max {n} words',
        gapPlaceholder: 'type your answer…',
        sentence2label: 'Complete:',
    }, result: {
        title: 'Results — {title}',
        breakdown: 'Answer breakdown',
        back: 'Back to home',
        perfect: 'Perfect score!',
        great: 'Great work!',
        good: 'Good effort — keep practising!',
        poor: 'Keep going — review the material!',
        yourAnswer: 'Your answer:',
        correct: 'Correct:',
        noAnswer: '(no answer)',
    }, common: {
        remove: 'Remove', words3: '3 words', words4: '4 words', words5: '5 words', langToggle: 'PL',
    },
};

const translations = {pl, en} as const;

/**
 * Returns the translated string for the given dot-separated key,
 * substituting any `{variable}` placeholders with the supplied values.
 *
 * Reactive: reads `locale.lang`, so any Svelte template or `$derived`
 * that calls `t()` will re-render on locale change.
 *
 * @param key - Dot-separated path into the translation tree (e.g. "nav.scan").
 * @param vars - Optional placeholder substitutions.
 * @returns Translated string, falling back to Polish then to the key itself.
 */
export function t(key: string, vars?: Record<string, string | number>): string {
    const tree: Record<string, unknown> = translations[locale.lang] as never;
    const parts = key.split('.');
    let node: unknown = tree;
    for (const part of parts) {
        if (node == null || typeof node !== 'object') {
            node = null;
            break;
        }
        node = (node as Record<string, unknown>)[part];
    }
    // Fallback to Polish if key not found in selected language.
    if (typeof node !== 'string') {
        let fallback: unknown = translations.pl as never;
        for (const part of parts) {
            if (fallback == null || typeof fallback !== 'object') {
                fallback = null;
                break;
            }
            fallback = (fallback as Record<string, unknown>)[part];
        }
        node = typeof fallback === 'string' ? fallback : key;
    }
    let str = node as string;
    if (vars) {
        for (const [k, v] of Object.entries(vars)) {
            str = str.replaceAll(`{${k}}`, String(v));
        }
    }
    return str;
}