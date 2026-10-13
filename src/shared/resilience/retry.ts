import { classifyFailure, isRetryable } from './failureClassifier';
import type { FailureKind } from './resilience.enums';

export type Sleep = (ms: number) => Promise<void>;

export const sleep: Sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export interface BackoffOptions {
  baseDelayMs: number;
  maxDelayMs: number;
  factor: number;
}

export const DEFAULT_BACKOFF: BackoffOptions = { baseDelayMs: 1000, maxDelayMs: 30_000, factor: 2 };

/** Delay before retry number `retryIndex` (0-based): base·factor^n, capped. */
export function backoffDelayMs(retryIndex: number, options: BackoffOptions = DEFAULT_BACKOFF): number {
  return Math.min(options.maxDelayMs, options.baseDelayMs * options.factor ** retryIndex);
}

export interface RetryOptions {
  maxAttempts: number;
  sleep?: Sleep;
  backoff?: BackoffOptions;
  onRetry?: (attempt: number, err: unknown, kind: FailureKind, delayMs: number) => void;
}

/**
 * Runs `operation`, retrying only rate-limit/transient failures with backoff.
 * Permanent/fatal failures and the last failed attempt are rethrown as-is.
 */
export async function retryTransient<T>(operation: () => Promise<T>, options: RetryOptions): Promise<T> {
  const wait = options.sleep ?? sleep;
  for (let attempt = 1; ; attempt++) {
    try {
      return await operation();
    } catch (err) {
      const kind = classifyFailure(err);
      if (!isRetryable(kind) || attempt >= options.maxAttempts) throw err;
      const delayMs = backoffDelayMs(attempt - 1, options.backoff);
      options.onRetry?.(attempt, err, kind, delayMs);
      await wait(delayMs);
    }
  }
}
