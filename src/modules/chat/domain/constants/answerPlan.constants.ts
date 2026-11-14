import { QuestionKind } from '../../../../shared/text';
import type { AnswerCompletenessSettings } from '../interfaces/answerPlan.interface';

/** 12/11 plan 08 §4 defaults (env names in parentheses). */
export const DEFAULT_ANSWER_COMPLETENESS: Readonly<AnswerCompletenessSettings> = {
  /** ANSWER_COMPLETENESS_ENABLED */
  enabled: true,
  /** ANSWER_MIN_WORDS_PER_QUESTION: essay question without marks (§6 decision: 300). */
  minWordsPerQuestion: 300,
  /** ESSAY_WORDS_PER_POINT: question with marks (§6 decision: keep points × 175). */
  wordsPerPoint: 175,
  /** ANSWER_SECTION_MAX_QUESTIONS */
  sectionMaxQuestions: 3,
  /** ANSWER_MAX_CONTINUATIONS (per call: first call / section) */
  maxContinuations: 2,
  /** ANSWER_COVERAGE_FIX */
  coverageFix: true,
  /** LONG_ANSWER_DEADLINE_MS: whole multi-part turn (client HTTP timeout is 6 min). */
  longAnswerDeadlineMs: 240_000,
  /** AI_MAX_OUTPUT_TOKENS */
  maxOutputTokens: 16_384,
  /** CHAT_DEADLINE_MS: each call (section, continuation, fix) gets its own. */
  callDeadlineMs: 90_000,
};

/** ~tokens per word (Vietnamese ~1.5–2; headroom), same as Essay Mode. */
export const ANSWER_TOKENS_PER_WORD = 2.2;

/** Room kept under the output cap for thinking/reasoning tokens. */
export const ANSWER_THINKING_RESERVE_TOKENS = 2_048;

/**
 * One call writes at most this much (~2 800 words); a longer plan is written in sections. At ~100 tok/s it ends
 * well inside one CHAT_DEADLINE_MS (90 s), and models tend to shorten the last questions of a longer single answer.
 * 8 essays × 300 words fit one call; 12 do not (→ 4 sections of 3).
 */
export const ANSWER_SINGLE_CALL_MAX_TOKENS = 6_144;

/** Expected words of answers whose length is not forced (only for the token estimate). */
export const UNFORCED_WORDS: Readonly<Record<QuestionKind, number>> = {
  [QuestionKind.ESSAY]: 300,
  [QuestionKind.SHORT]: 120,
  [QuestionKind.CALC]: 250,
  [QuestionKind.DIAGRAM]: 300,
};

/** Coverage: an answer below this share of its target words counts as missing (08 §2: 60 %). */
export const COVERAGE_MIN_WORD_RATIO = 0.6;

/** Between sections and before the coverage-fix part. */
export const ANSWER_PART_SEPARATOR = '\n\n';

/** Between the question, the plan block and the section block in the user text. */
export const ANSWER_BLOCK_SEPARATOR = '\n\n';

/** Placeholder of a prompt template: `{{name}}`. */
export const TEMPLATE_PLACEHOLDER = /\{\{(\w+)\}\}/g;

/** "short" in the plan line of a question whose length is not forced. */
export const PLAN_SHORT_MARK = 'short';

/** Shown in the section block when no question was written yet. */
export const PLAN_NOTHING_DONE = 'none';

/** Prompt ids (prompts/skills/answer/*.md). */
export const ANSWER_PROMPT_IDS = {
  plan: 'skill.answer.plan',
  section: 'skill.answer.section',
  continue: 'skill.answer.continue',
  coverageFix: 'skill.answer.coverage-fix',
} as const;

/** Turns kept for `longTurnP95Ms` (ring buffer, RAM only). */
export const ANSWER_METRICS_CAPACITY = 500;

export const ANSWER_LOG_TAG = '[answers]';
