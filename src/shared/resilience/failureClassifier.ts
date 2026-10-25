import { errorMessage, TimeoutError } from '../errors';
import { HttpStatus } from '../http/enums/http.enums';
import { FailureKind } from './enums/resilience.enums';
import { ErrorLike } from './interfaces/failureClassifier.interface';
import { STATUS_IN_MESSAGE, RATE_LIMIT_PATTERN, FATAL_STATUSES, TRANSIENT_CLIENT_STATUSES, SERVER_ERROR_MIN, FATAL_PATTERN, CLIENT_ERROR_MIN } from './constants/failureClassifier.constants';

/** HTTP status from SDK errors (`status`/`statusCode`) or from messages like "failed: 400 Bad Request". */
export function extractHttpStatus(err: unknown): number | undefined {
  const e = (err ?? {}) as ErrorLike;
  for (const candidate of [e.status, e.statusCode]) {
    if (typeof candidate === 'number') return candidate;
  }
  const match = String(e.message ?? '').match(STATUS_IN_MESSAGE);
  return match ? Number(match[1]) : undefined;
}

/**
 * Decides how a failed external call is retried. Unknown errors (network
 * blips, empty provider responses) are TRANSIENT so they get another try.
 */
export function classifyFailure(err: unknown): FailureKind {
  if (err instanceof TimeoutError) return FailureKind.TRANSIENT;

  const message = errorMessage(err);
  const status = extractHttpStatus(err);
  if (status === HttpStatus.TOO_MANY_REQUESTS || RATE_LIMIT_PATTERN.test(message)) return FailureKind.RATE_LIMITED;
  if ((status !== undefined && FATAL_STATUSES.has(status)) || FATAL_PATTERN.test(message)) return FailureKind.FATAL;
  if (status === undefined) return FailureKind.TRANSIENT;
  if (TRANSIENT_CLIENT_STATUSES.has(status) || status >= SERVER_ERROR_MIN) return FailureKind.TRANSIENT;
  if (status >= CLIENT_ERROR_MIN) return FailureKind.PERMANENT;
  return FailureKind.TRANSIENT;
}

export function isRetryable(kind: FailureKind): boolean {
  return kind === FailureKind.RATE_LIMITED || kind === FailureKind.TRANSIENT;
}
