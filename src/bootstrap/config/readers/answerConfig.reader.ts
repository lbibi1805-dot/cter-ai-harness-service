import { DEFAULT_ANSWER_COMPLETENESS, type AnswerCompletenessSettings } from '../../../modules/chat';
import { DEFAULT_AI_LATENCY, DEFAULT_PROVIDER_TUNING } from '../../../modules/ai';
import { DEFAULT_ESSAY_SETTINGS } from '../../../modules/essay';
import { readBoolean, readInt } from '../../../shared/config/env';

/** ANSWER_* + LONG_ANSWER_DEADLINE_MS (12/11 plan 08 §4); the cap, words per mark and call deadline are shared settings. */
export function readAnswerConfig(): AnswerCompletenessSettings {
  return {
    enabled: readBoolean('ANSWER_COMPLETENESS_ENABLED', DEFAULT_ANSWER_COMPLETENESS.enabled),
    minWordsPerQuestion: readInt('ANSWER_MIN_WORDS_PER_QUESTION', DEFAULT_ANSWER_COMPLETENESS.minWordsPerQuestion),
    wordsPerPoint: readInt('ESSAY_WORDS_PER_POINT', DEFAULT_ESSAY_SETTINGS.wordsPerPoint),
    sectionMaxQuestions: readInt('ANSWER_SECTION_MAX_QUESTIONS', DEFAULT_ANSWER_COMPLETENESS.sectionMaxQuestions),
    maxContinuations: readInt('ANSWER_MAX_CONTINUATIONS', DEFAULT_ANSWER_COMPLETENESS.maxContinuations),
    coverageFix: readBoolean('ANSWER_COVERAGE_FIX', DEFAULT_ANSWER_COMPLETENESS.coverageFix),
    longAnswerDeadlineMs: readInt('LONG_ANSWER_DEADLINE_MS', DEFAULT_ANSWER_COMPLETENESS.longAnswerDeadlineMs),
    maxOutputTokens: readInt('AI_MAX_OUTPUT_TOKENS', DEFAULT_PROVIDER_TUNING.maxOutputTokens),
    callDeadlineMs: readInt('CHAT_DEADLINE_MS', DEFAULT_AI_LATENCY.chatDeadlineMs),
  };
}
