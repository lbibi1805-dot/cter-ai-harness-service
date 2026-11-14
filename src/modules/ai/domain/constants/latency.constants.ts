import { DEFAULT_CIRCUIT_BREAKER } from '../../../../shared/resilience/constants/circuitBreaker.constants';
import { GeminiThinkingLevel, OpenAIReasoningEffort, PromptCacheKeyMode } from '../enums/latency.enums';
import type { AiLatencySettings, ProviderTuning } from '../interfaces/latency.interface';

export const DEFAULT_FIRST_TOKEN_TIMEOUT_MS = 15_000;

export const DEFAULT_IDLE_TIMEOUT_MS = 20_000;

export const DEFAULT_CHAT_DEADLINE_MS = 90_000;

/** Canvas polling (file Q&A / conversation requests): background work, long PDF answers. */
export const DEFAULT_CANVAS_DEADLINE_MS = 300_000;

export const DEFAULT_AI_LATENCY: AiLatencySettings = {
  firstTokenTimeoutMs: DEFAULT_FIRST_TOKEN_TIMEOUT_MS,
  idleTimeoutMs: DEFAULT_IDLE_TIMEOUT_MS,
  chatDeadlineMs: DEFAULT_CHAT_DEADLINE_MS,
  canvasDeadlineMs: DEFAULT_CANVAS_DEADLINE_MS,
  circuit: DEFAULT_CIRCUIT_BREAKER,
};

/**
 * AI_MAX_OUTPUT_TOKENS: output cap of every route (Gemini, OpenAI, Claude, Grok, OpenRouter, agent) — 08 Bước 2.
 * Reasoning/thinking tokens count against it on reasoning models; clamped per model by MODEL_OUTPUT_LIMITS.
 */
export const DEFAULT_MAX_OUTPUT_TOKENS = 16_384;

/** 08 Bước 2: the answer keeps at least this many tokens of the cap; a thinking level that leaves less is lowered. */
export const MIN_ANSWER_TOKENS_AFTER_THINKING = 4_096;

export const DEFAULT_PROVIDER_TUNING: ProviderTuning = {
  maxOutputTokens: DEFAULT_MAX_OUTPUT_TOKENS,
  geminiThinkingLevel: GeminiThinkingLevel.MINIMAL,
  openaiReasoningEffort: OpenAIReasoningEffort.LOW,
  openaiPromptCacheKey: PromptCacheKeyMode.CONVERSATION,
  claudePromptCache: false,
};

/** Invocations kept in memory by the LatencyRecorder (ring buffer). */
export const LATENCY_RECORDER_CAPACITY = 1000;

/** Default window of `LatencyRecorder.summary()`: one hour. */
export const DEFAULT_LATENCY_WINDOW_MS = 3_600_000;

/** Statuses that count toward a model's circuit breaker: overloaded / unavailable / gateway timeout. */
export const CIRCUIT_STATUSES: ReadonlySet<number> = new Set([503, 504, 529]);

export const CIRCUIT_MESSAGE_PATTERN = /overloaded|unavailable|high demand/i;
