import type { GeminiThinkingLevel, OpenAIReasoningEffort, OpenAIServiceTier, PromptCacheKeyMode } from '../enums/latency.enums';
import type { CircuitBreakerOptions } from '../../../../shared/resilience/interfaces/circuitBreaker.interface';

/** Timeouts and the circuit breaker of the single-shot invocation (07 §3.2). */
export interface AiLatencySettings {
  /** AI_FIRST_TOKEN_TIMEOUT_MS: streamed attempt aborted when no text arrives in time. */
  firstTokenTimeoutMs: number;
  /** AI_IDLE_TIMEOUT_MS: streamed attempt aborted after this long without a new chunk. */
  idleTimeoutMs: number;
  /** CHAT_DEADLINE_MS: whole request (retrieval, direct chain and OpenRouter) must finish within it. */
  chatDeadlineMs: number;
  /**
   * CANVAS_DEADLINE_MS: whole AI chain of one Canvas polling item (file Q&A, Canvas conversation request).
   * Nobody watches a stream there, and long PDF answers need more than the interactive chat deadline.
   */
  canvasDeadlineMs: number;
  circuit: CircuitBreakerOptions;
}

/** Per-provider request tuning (07 §3.3, 18 §5). */
export interface ProviderTuning {
  /** AI_MAX_OUTPUT_TOKENS: Gemini `maxOutputTokens`, OpenAI `max_output_tokens` / `max_completion_tokens`. */
  maxOutputTokens: number;
  geminiThinkingLevel: GeminiThinkingLevel;
  openaiReasoningEffort: OpenAIReasoningEffort;
  openaiServiceTier?: OpenAIServiceTier;
  openaiPromptCacheKey: PromptCacheKeyMode;
  /** PROMPT_CACHE_CLAUDE: `cache_control` breakpoints on the system prompt and the last history turn. */
  claudePromptCache: boolean;
}
