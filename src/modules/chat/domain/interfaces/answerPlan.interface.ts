import type { SplitQuestion } from '../../../../shared/text';
import type { AnswerCompletenessDetails } from '../../../agent/domain';

export type { AnswerCompletenessDetails };

/** ANSWER_* settings (12/11 plan 08 §4). */
export interface AnswerCompletenessSettings {
  /** ANSWER_COMPLETENESS_ENABLED: false = the orchestrator passes every request through (rollback). */
  enabled: boolean;
  /** ANSWER_MIN_WORDS_PER_QUESTION: target of an essay question without marks. */
  minWordsPerQuestion: number;
  /** ESSAY_WORDS_PER_POINT: target per mark. */
  wordsPerPoint: number;
  /** ANSWER_SECTION_MAX_QUESTIONS: questions per section when the plan does not fit one call. */
  sectionMaxQuestions: number;
  /** ANSWER_MAX_CONTINUATIONS: auto-continues per call (first call or section). */
  maxContinuations: number;
  /** ANSWER_COVERAGE_FIX: one extra call writing only the missing questions. */
  coverageFix: boolean;
  /** LONG_ANSWER_DEADLINE_MS: deadline of a whole multi-part turn. */
  longAnswerDeadlineMs: number;
  /** AI_MAX_OUTPUT_TOKENS: decides whether the plan fits one call. */
  maxOutputTokens: number;
  /** CHAT_DEADLINE_MS: per-call deadline of the extra calls. */
  callDeadlineMs: number;
}

/** One planned question: the split question plus its target length. */
export interface PlannedQuestion extends SplitQuestion {
  /** Words to write; absent = not forced (short / calc / diagram without marks). */
  targetWords?: number;
}

export interface AnswerPlan {
  preamble: string;
  questions: PlannedQuestion[];
  /** Expected output tokens of the whole answer. */
  estimatedTokens: number;
}

/** Coverage check (rule-based, no model call). */
export interface AnswerCoverage {
  /** Ids of the questions without a label in the answer or below 60 % of their target words. */
  missing: string[];
  /** Words written per question id (0 when its label was not found). */
  words: Record<string, number>;
}

/** One turn as the metrics recorder sees it. */
export interface AnswerTurnRecord extends AnswerCompletenessDetails {
  outputTokens?: number;
  durationMs: number;
  /** Multi-question, sectioned, continued or fixed. */
  long: boolean;
}

/** `answers` block of `GET /api/metrics/latency` (RAM only). */
export interface AnswerMetricsSummary {
  turns: number;
  questionsPerTurnAvg: number;
  sectionsTotal: number;
  continuationsTotal: number;
  /** Turns whose answer was still cut by the output cap after every continuation. */
  truncatedRemaining: number;
  /** Share of turns with every question answered and nothing cut, in [0, 1]. */
  completeRate: number;
  outputTokensAvg: number;
  /** p95 duration of long turns (multi-question / sectioned / continued); null without one. */
  longTurnP95Ms: number | null;
}

/** Templates from prompts/skills/answer/*.md (or their built-in copies). */
export interface AnswerPrompts {
  plan: string;
  section: string;
  continue: string;
  coverageFix: string;
}
