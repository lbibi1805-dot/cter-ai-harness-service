import { ThinkingLevel, type ThinkingConfig } from '@google/genai';
import { GeminiThinkingLevel } from '../../domain/enums/latency.enums';
import { MIN_ANSWER_TOKENS_AFTER_THINKING } from '../../domain/constants/latency.constants';
import { logger } from '../../../../shared/logging/logger';
import {
  GEMINI_THINKING_LEVEL_ORDER,
  GEMINI_THINKING_TOKEN_ESTIMATES,
  GEMINI_BUDGET_MODEL_PATTERN,
  GEMINI_PRO_MIN_THINKING_BUDGET,
  GEMINI_PRO_MODEL_PATTERN,
  GEMINI_THINKING_BUDGETS,
  GEMINI_THINKING_LEVELS,
} from '../constants/gemini.constants';

/**
 * Gemini 3.x takes `thinkingLevel` (MINIMAL is the fastest; Pro only goes down to LOW); 2.5 models take a token
 * budget (0 turns thinking off, except on Pro which needs at least 128).
 */
export function geminiThinkingConfig(model: string, level: GeminiThinkingLevel): ThinkingConfig {
  const isPro = GEMINI_PRO_MODEL_PATTERN.test(model);
  if (GEMINI_BUDGET_MODEL_PATTERN.test(model)) {
    const budget = GEMINI_THINKING_BUDGETS[level];
    return { thinkingBudget: isPro && budget >= 0 ? Math.max(budget, GEMINI_PRO_MIN_THINKING_BUDGET) : budget };
  }
  const sdkLevel = GEMINI_THINKING_LEVELS[level];
  return { thinkingLevel: isPro && sdkLevel === ThinkingLevel.MINIMAL ? ThinkingLevel.LOW : sdkLevel };
}

/**
 * 08 Bước 2: thinking tokens count against `maxOutputTokens`. When the level's expected thinking would leave the
 * answer fewer than MIN_ANSWER_TOKENS_AFTER_THINKING tokens, step the level down (logged) until it fits.
 */
export function fitThinkingLevel(model: string, level: GeminiThinkingLevel, maxOutputTokens: number): GeminiThinkingLevel {
  let index = GEMINI_THINKING_LEVEL_ORDER.indexOf(level);
  while (index > 0 && maxOutputTokens - GEMINI_THINKING_TOKEN_ESTIMATES[GEMINI_THINKING_LEVEL_ORDER[index]] < MIN_ANSWER_TOKENS_AFTER_THINKING) index--;
  const fitted = index >= 0 ? GEMINI_THINKING_LEVEL_ORDER[index] : level;
  if (fitted !== level) logger.info(`[gemini] ${model}: thinking ${level} → ${fitted} (cap ${maxOutputTokens} tokens leaves < ${MIN_ANSWER_TOKENS_AFTER_THINKING} for the answer)`);
  return fitted;
}
