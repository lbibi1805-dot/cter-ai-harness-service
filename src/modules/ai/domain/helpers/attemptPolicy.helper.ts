import { TimeoutError, errorMessage } from '../../../../shared/errors';
import { FailureKind } from '../../../../shared/resilience/enums/resilience.enums';
import { extractHttpStatus } from '../../../../shared/resilience/failureClassifier';
import { SERVER_ERROR_MIN } from '../../../../shared/resilience/constants/failureClassifier.constants';
import { CIRCUIT_MESSAGE_PATTERN, CIRCUIT_STATUSES } from '../constants/latency.constants';
import { AttemptDecision } from '../enums/attemptPolicy.enums';
import { AttemptOutcome } from '../enums/latency.enums';
import type { FailedAttempt } from '../interfaces/attemptPolicy.interface';

/**
 * What to do after a failed adapter attempt (07 §3.2):
 * - fatal (credentials/billing) stops the route;
 * - once text was streamed, or on a timeout, the same model is never retried (next model, the client is reset);
 * - only 429 and 5xx are retried on the same model, up to `limit` attempts, unless its circuit just opened;
 * - everything else (4xx, empty reply, network error without status) moves to the next model.
 */
export function decideAfterFailure(failure: FailedAttempt): AttemptDecision {
  if (failure.kind === FailureKind.FATAL) return AttemptDecision.STOP;
  if (failure.emittedText || failure.timedOut || failure.circuitOpen) return AttemptDecision.NEXT_MODEL;
  if (failure.attemptOnModel >= failure.limit) return AttemptDecision.NEXT_MODEL;
  if (failure.kind === FailureKind.RATE_LIMITED) return AttemptDecision.RETRY_SAME;
  const status = failure.status;
  return status !== undefined && status >= SERVER_ERROR_MIN ? AttemptDecision.RETRY_SAME : AttemptDecision.NEXT_MODEL;
}

/** 503/504/529, "overloaded"/"unavailable" bodies and timeouts count toward the model's circuit breaker. */
export function isCircuitFailure(error: unknown): boolean {
  if (error instanceof TimeoutError) return true;
  const status = extractHttpStatus(error);
  return (status !== undefined && CIRCUIT_STATUSES.has(status)) || CIRCUIT_MESSAGE_PATTERN.test(errorMessage(error));
}

export function attemptOutcome(kind: FailureKind, timedOut: boolean): AttemptOutcome {
  if (timedOut) return AttemptOutcome.TIMEOUT;
  switch (kind) {
    case FailureKind.RATE_LIMITED:
      return AttemptOutcome.RATE_LIMITED;
    case FailureKind.PERMANENT:
      return AttemptOutcome.PERMANENT;
    case FailureKind.FATAL:
      return AttemptOutcome.FATAL;
    default:
      return AttemptOutcome.TRANSIENT;
  }
}
