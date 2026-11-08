/** A case passes at this coverage (with no References section, no forbidden text, every required citation). */
export const PASS_COVERAGE = 0.6;

/** Score multipliers for rule violations. */
export const REFERENCES_PENALTY = 0.8;
export const FORBIDDEN_PENALTY = 0.5;
export const MISSING_CITATION_PENALTY = 0.8;

/** Alternatives inside one expected point: `mutex|khóa`. */
export const POINT_ALTERNATIVE_SEPARATOR = '|';

/** A References-style heading anywhere in the answer (the prompt asks for none). */
export const REFERENCES_HEADING = /^[ \t]*#{1,6}[ \t]*(?:\*\*)?[ \t]*(?:references?|sources?|nguồn(?:[ \t]+tham[ \t]+khảo)?|tài[ \t]+liệu[ \t]+tham[ \t]+khảo)[ \t]*:?[ \t]*(?:\*\*)?[ \t]*$/im;

/** `evals/results/` layout written by `npm run eval` and read by `GET /api/evals`. */
export const EVAL_RESULTS_DIR = 'evals/results';
export const EVAL_BASELINE_FILE = 'baseline.json';
export const EVAL_RESULT_EXTENSION = '.json';
