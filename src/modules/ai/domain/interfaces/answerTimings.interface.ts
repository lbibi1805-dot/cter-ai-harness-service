import type { AttemptOutcome } from '../enums/latency.enums';

/** One adapter attempt (or a model skipped by its circuit breaker, `ms: 0`). */
export interface AttemptTiming {
  model: string;
  outcome: AttemptOutcome;
  ms: number;
}

/** Where the time of one answer went. Token counts come from the attempt that answered. */
export interface AnswerTimings {
  /** Request start → first text delta sent to the client (streamed answers only). */
  ttftMs?: number;
  /** Request start (retrieval included) → answer ready. */
  totalMs: number;
  attempts: AttemptTiming[];
  inputTokens?: number;
  outputTokens?: number;
  /** Input tokens served from the provider's prompt cache. */
  cachedTokens?: number;
  /** Prompt preparation (embedding + vector search + rerank), absent for `answerPrepared`. */
  retrievalMs?: number;
  /** LLM invocations behind the answer when a pipeline made several (Essay Mode: analysis + writing + self-check). */
  llmCalls?: number;
}
