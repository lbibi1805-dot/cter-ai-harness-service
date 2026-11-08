import { GeminiThinkingLevel } from '../../../modules/ai';
import { DEFAULT_ESSAY_SETTINGS, type EssaySettings } from '../../../modules/essay';
import { readBoolean, readEnum, readInt } from '../../../shared/config/env';

/** ESSAY_* (15 §6): explicit `/essay` / `mode: "essay"` always work; ESSAY_MODE_ENABLED adds the auto detector. */
export function readEssayConfig(): EssaySettings {
  return {
    autoDetect: readBoolean('ESSAY_MODE_ENABLED', DEFAULT_ESSAY_SETTINGS.autoDetect),
    maxChunks: readInt('ESSAY_MAX_CHUNKS', DEFAULT_ESSAY_SETTINGS.maxChunks),
    wordsPerPoint: readInt('ESSAY_WORDS_PER_POINT', DEFAULT_ESSAY_SETTINGS.wordsPerPoint),
    selfCheck: readBoolean('ESSAY_SELF_CHECK', DEFAULT_ESSAY_SETTINGS.selfCheck),
    thinkingLevel: readEnum('ESSAY_THINKING_LEVEL', GeminiThinkingLevel, DEFAULT_ESSAY_SETTINGS.thinkingLevel),
    analysisTimeoutMs: readInt('ESSAY_ANALYSIS_TIMEOUT_MS', DEFAULT_ESSAY_SETTINGS.analysisTimeoutMs),
    selfCheckTimeoutMs: readInt('ESSAY_SELF_CHECK_TIMEOUT_MS', DEFAULT_ESSAY_SETTINGS.selfCheckTimeoutMs),
  };
}
