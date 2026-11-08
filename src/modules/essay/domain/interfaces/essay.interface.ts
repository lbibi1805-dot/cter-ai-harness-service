import type { GeminiThinkingLevel } from '../../../ai/domain/enums/latency.enums';
import type { EssayTrigger, EssayVerb } from '../enums/essay.enums';

/** What the chat request asked for (parsed from `mode: "essay"` / `/essay strict 3đ`). */
export interface EssayRequestOptions {
  trigger: EssayTrigger;
  /** `/essay strict`: run the self-check pass even when ESSAY_SELF_CHECK is off. */
  strict: boolean;
  /** `/essay 3đ`: overrides the points found in the question. */
  points?: number;
}

/** `/essay …` split into its flags and the question. */
export interface ParsedEssayCommand {
  question: string;
  strict: boolean;
  points?: number;
}

/** Step ① (aux model JSON or the heuristic fallback). */
export interface EssayAnalysis {
  subject: string;
  /** The parts of the question that each need an answer; never empty. */
  aspects: string[];
  verbs: EssayVerb[];
  points?: number;
  targetWords?: number;
  /** True when the aux model produced it, false for the heuristic. */
  fromModel: boolean;
}

/** Returned with the answer (`essay` in the chat DTO). */
export interface EssayDetails {
  /** `<outline>` as written by the model (unknown citation ids removed). */
  outline: string;
  aspects: string[];
  targetWords: number;
  /** Share of aspects with at least one chunk in the context, in [0, 1]. */
  coverage: number;
  strict: boolean;
  wordCount: number;
  /** `[c:<id>]` citations whose id was not in the context (dropped). */
  droppedCitations: number;
  trigger: EssayTrigger;
  subject?: string;
  /** Course domain whose rubric was used (`domain.software-testing`), absent = generic rubric. */
  domain?: string;
}

/** ESSAY_* settings. */
export interface EssaySettings {
  /** ESSAY_MODE_ENABLED: the automatic detector (explicit `/essay` / `mode: "essay"` always work). */
  autoDetect: boolean;
  /** ESSAY_MAX_CHUNKS: context budget. */
  maxChunks: number;
  /** ESSAY_WORDS_PER_POINT. */
  wordsPerPoint: number;
  /** ESSAY_SELF_CHECK: step ⑦ for every essay (otherwise only `/essay strict`). */
  selfCheck: boolean;
  /** ESSAY_THINKING_LEVEL: Gemini thinking for the writing call. */
  thinkingLevel: GeminiThinkingLevel;
  /** ESSAY_ANALYSIS_TIMEOUT_MS: step ① gives up and uses the heuristic. */
  analysisTimeoutMs: number;
  /** ESSAY_SELF_CHECK_TIMEOUT_MS: step ⑦ gives up and keeps the essay. */
  selfCheckTimeoutMs: number;
}

/** Chunks picked for the prompt and how well they cover the aspects. */
export interface EssaySelection<T> {
  chunks: T[];
  coverage: number;
}

/** A model reply split into its parts. */
export interface EssayOutput {
  outline: string;
  essay: string;
}

/** Citation check of the outline/essay against the chunk ids sent in the prompt. */
export interface CitationCheck {
  /** Valid ids, in order of first citation, deduped. */
  valid: string[];
  unknown: string[];
}

/** One line of `evals/golden/essay.jsonl` (snake_case as stored). */
export interface EssayGoldenCase {
  id: string;
  question: string;
  aspects: string[];
  /** Each term must appear in the essay (case-insensitive); `a|b` = any alternative. */
  must_terms: string[];
  points?: number;
  target_words: number;
  /** Vault path prefixes (case-insensitive) that must appear in `sources`. */
  must_cite?: string[];
}

/** What `/api/chat` returned for an essay (subset of the DTO; `trace` requested with includeTrace). */
export interface EssayGoldenAnswer {
  text: string;
  sources?: { file: string }[];
  essay?: { outline: string; coverage: number; droppedCitations: number; wordCount?: number };
  trace?: { contexts: { chunkId: string }[] };
}

export interface EssayGoldenScore {
  id: string;
  missingTerms: string[];
  wordCount: number;
  targetWords: number;
  /** wordCount within ±ESSAY_EVAL_LENGTH_TOLERANCE of the target. */
  lengthOk: boolean;
  /** Outline citations all point at chunks of the context and none was dropped. */
  citationsValid: boolean;
  /** Retrieval aspect coverage reported by the server. */
  coverage: number;
  missingCitations: string[];
  /** Rule score in [0, 1]. */
  score: number;
  pass: boolean;
  /** 1–5 per criterion from the optional LLM judge. */
  judge?: Record<string, number>;
}
