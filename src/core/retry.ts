/**
 * Pure retry/backoff helpers — extracted per PLAN_MODULE_ARCHITECTURE.md mục 6 Phase 0
 * step 4. Copied from the exponential backoff math inside
 * `KnowledgeIndexer`'s embed-batch retry loop (429 / fetch-failed handling), which is
 * not yet wired to this module — see mục 4.B (indexer split happens in Phase 3).
 */

/** Exponential backoff with a cap, matching `KnowledgeIndexer`'s 429 handling:
 * `min(baseMs * 2^attempt, capMs)`. `attempt` is 0-indexed (first retry = attempt 0). */
export function computeBackoffMs(baseMs: number, attempt: number, capMs: number): number {
  return Math.min(baseMs * Math.pow(2, attempt), capMs);
}

export interface RetryClassification {
  /** Whether this error should be retried at all. */
  retry: boolean;
  /** Backoff base (ms) to use if retried — matches the two distinct bases the
   * indexer uses today (429 vs generic fetch failure). */
  baseMs: number;
  capMs: number;
}

/** Classifies an error message the same way `KnowledgeIndexer`'s embed-batch loop
 * does today: rate-limit (429) gets a longer base/cap backoff than a generic
 * fetch failure, anything else is not retried. */
export function classifyEmbedBatchError(errorMessage: string): RetryClassification {
  if (errorMessage.includes('429')) {
    return { retry: true, baseMs: 3000, capMs: 30000 };
  }
  if (errorMessage.includes('fetch failed') || errorMessage.includes('fetch')) {
    return { retry: true, baseMs: 2000, capMs: 15000 };
  }
  return { retry: false, baseMs: 0, capMs: 0 };
}
