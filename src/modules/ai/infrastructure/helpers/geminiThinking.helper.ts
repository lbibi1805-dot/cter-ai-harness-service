import { ThinkingLevel, type ThinkingConfig } from '@google/genai';
import { GeminiThinkingLevel } from '../../domain/enums/latency.enums';
import {
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
