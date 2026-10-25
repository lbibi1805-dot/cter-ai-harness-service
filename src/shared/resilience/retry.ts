import { attempt } from './attempt';
import { classifyFailure, isRetryable } from './failureClassifier';
import { FailureKind } from './enums/resilience.enums';
import { Sleep, BackoffOptions, FallbackPolicy, FallbackSuccess, RetryOptions, FallbackFailure } from './interfaces/retry.interface';
import { DEFAULT_BACKOFF } from './constants/retry.constants';

export const sleep: Sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Delay before retry number `retryIndex` (0-based): base·factor^n, capped. */
export function backoffDelayMs(retryIndex: number, options: BackoffOptions = DEFAULT_BACKOFF): number {
  return Math.min(options.maxDelayMs, options.baseDelayMs * options.factor ** retryIndex);
}

/**
 * Runs `operation`, retrying only rate-limit/transient failures with backoff.
 * Permanent/fatal failures and the last failed attempt are rethrown as-is.
 */
export async function retryTransient<T>(operation: () => Promise<T>, options: RetryOptions): Promise<T> {
  const wait = options.sleep ?? sleep;
  for (let attemptNumber = 1; ; attemptNumber++) {
    const result = await attempt(operation);
    if (result.ok) return result.value;

    const kind = classifyFailure(result.error);
    if (!isRetryable(kind) || attemptNumber >= options.maxAttempts) throw result.error;
    const delayMs = backoffDelayMs(attemptNumber - 1, options.backoff);
    options.onRetry?.(attemptNumber, result.error, kind, delayMs);
    await wait(delayMs);
  }
}

/**
 * Tries each target in order: TRANSIENT/RATE_LIMITED failures are retried on
 * the same target with backoff, PERMANENT ones move to the next target, and a
 * FATAL failure stops everything. `toError` builds what is finally thrown.
 */
export async function runWithFallback<T>(
  targets: readonly string[],
  call: (target: string) => Promise<T>,
  policy: FallbackPolicy,
  toError: (failure: FallbackFailure) => Error,
): Promise<FallbackSuccess<T>> {
  const wait = policy.sleep ?? sleep;
  let attempts = 0;
  let last: FallbackFailure = { error: undefined, kind: FailureKind.TRANSIENT, attempts: 0, target: targets[0] };

  for (const [index, target] of targets.entries()) {
    for (let attemptOnTarget = 1; ; attemptOnTarget++) {
      attempts++;
      policy.onAttempt?.(target);
      const result = await attempt(() => call(target));
      if (result.ok) return { value: result.value, target, attempts };

      const kind = classifyFailure(result.error);
      last = { error: result.error, kind, attempts, target };
      if (kind === FailureKind.FATAL) throw toError(last);

      const limit = policy.attemptsPerTarget(kind);
      if (kind === FailureKind.PERMANENT || attemptOnTarget >= limit) {
        const next = targets[index + 1];
        if (next) policy.onFallback?.(target, next, result.error, kind);
        break;
      }
      const delayMs = backoffDelayMs(attemptOnTarget - 1, policy.backoff);
      policy.onRetry?.(target, attemptOnTarget, result.error, kind, delayMs);
      await wait(delayMs);
    }
  }
  throw toError(last);
}
