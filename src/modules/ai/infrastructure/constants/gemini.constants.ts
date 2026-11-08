import { ThinkingLevel } from '@google/genai';
import { GeminiThinkingLevel } from '../../domain/enums/latency.enums';

/** Gemini 3.x: GEMINI_THINKING_LEVEL → SDK thinking level. */
export const GEMINI_THINKING_LEVELS: Readonly<Record<GeminiThinkingLevel, ThinkingLevel>> = {
  [GeminiThinkingLevel.MINIMAL]: ThinkingLevel.MINIMAL,
  [GeminiThinkingLevel.LOW]: ThinkingLevel.LOW,
  [GeminiThinkingLevel.MEDIUM]: ThinkingLevel.MEDIUM,
  [GeminiThinkingLevel.HIGH]: ThinkingLevel.HIGH,
};

/** Gemini 2.5: GEMINI_THINKING_LEVEL → thinking budget in tokens (0 = off, -1 = dynamic). */
export const GEMINI_THINKING_BUDGETS: Readonly<Record<GeminiThinkingLevel, number>> = {
  [GeminiThinkingLevel.MINIMAL]: 0,
  [GeminiThinkingLevel.LOW]: 1024,
  [GeminiThinkingLevel.MEDIUM]: 8192,
  [GeminiThinkingLevel.HIGH]: -1,
};

/** Gemini 2.5 Pro cannot turn thinking off; this is its smallest budget. */
export const GEMINI_PRO_MIN_THINKING_BUDGET = 128;

/** Models that take `thinkingBudget` instead of `thinkingLevel`. */
export const GEMINI_BUDGET_MODEL_PATTERN = /^gemini-2\./i;

/** Pro models do not accept the MINIMAL level; LOW is used instead. */
export const GEMINI_PRO_MODEL_PATTERN = /-pro/i;

export const GEMINI_USER_ROLE = 'user';

export const GEMINI_MODEL_ROLE = 'model';

/** Default GEMINI_INLINE_IMAGES_MAX_MB (Gemini rejects inline requests over 20 MB; the margin covers the prompt). */
export const DEFAULT_GEMINI_INLINE_IMAGES_MAX_BYTES = 15 * 1024 * 1024;

/** Gemini Files API objects expire after 48 h; cached URIs are dropped an hour earlier. */
export const GEMINI_FILE_CACHE_TTL_MS = 47 * 60 * 60 * 1000;

/** Uploaded-file URIs kept in RAM (oldest evicted first). */
export const GEMINI_FILE_CACHE_MAX_ENTRIES = 1000;
