import type { ModelRoute } from '../enums/ai.enums';

/** One invocation as recorded in memory (success or failure). */
export interface LatencyEntry {
  /** Epoch ms when the invocation finished. */
  at: number;
  provider: string;
  /** The model that answered, or the last one tried on failure. */
  model: string;
  route?: ModelRoute;
  /** InvocationKind, or `AIRequest.purpose` when the caller set one. */
  kind: string;
  ttftMs?: number;
  totalMs: number;
  /** Adapter calls made (retries and fallbacks included). */
  attempts: number;
  /** FailureKind / `deadline`; absent on success. */
  errorKind?: string;
  inputTokens?: number;
  cachedTokens?: number;
  outputTokens?: number;
}

export interface Percentiles {
  p50: number;
  p95: number;
}

export interface LatencyGroupSummary {
  provider: string;
  model: string;
  count: number;
  /** Retries + fallbacks: attempts beyond the first, summed. */
  retries: number;
  errors: number;
  errorsByKind: Record<string, number>;
  /** Null when no entry of the group streamed. */
  ttftMs: Percentiles | null;
  totalMs: Percentiles;
  inputTokens: number;
  cachedTokens: number;
  outputTokens: number;
  /** cachedTokens / inputTokens; null without input token counts. */
  cacheHitRate: number | null;
}

export interface LatencySummary {
  windowMs: number;
  /** Entries in the window. */
  count: number;
  /** Per provider/model, busiest first. */
  groups: LatencyGroupSummary[];
}
