/** One line of `evals/golden/*.jsonl` (snake_case as stored). */
export interface GoldenCase {
  id: string;
  question: string;
  /** Each point is covered when the answer contains it (case-insensitive); `a|b` = any alternative. */
  expected_points: string[];
  /** Vault path prefixes that must appear in the answer's `sources`. */
  must_cite?: string[];
  /** Text that must not appear in the answer (case-insensitive). */
  forbidden?: string[];
  /** Defaults to the script's EVAL_PROVIDER / single-shot. */
  provider?: string;
  mode?: string;
}

/** What the harness answered (subset of the `/api/chat` JSON). */
export interface GoldenAnswer {
  text: string;
  sources?: { file: string }[];
}

export interface GoldenScore {
  id: string;
  /** Share of expected points found, in [0, 1]. */
  coverage: number;
  missingPoints: string[];
  /** The answer still ends with a References/Sources section. */
  hasReferencesSection: boolean;
  forbiddenHits: string[];
  missingCitations: string[];
  /** Rule score in [0, 1] (coverage with penalties). */
  score: number;
  pass: boolean;
  /** 0–1 from the optional LLM judge. */
  judge?: number;
}

export interface GoldenRunSummary {
  promptVersion: string;
  date: string;
  provider: string;
  model?: string;
  meanScore: number;
  passRate: number;
  results: GoldenScore[];
}

/** One row of `GET /api/evals`. */
export interface EvalResultEntry {
  file: string;
  /** `golden-qa` (npm run eval) or `rule-compliance` (npm run eval:rules). */
  kind: string;
  date: string | null;
  promptVersion: string | null;
  /** Mean score 0-1. */
  score: number;
  passRate: number | null;
  baseline: number | null;
  delta: number | null;
}
