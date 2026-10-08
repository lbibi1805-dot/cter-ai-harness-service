import { FailureKind } from './resilience.enums';

const RATE_LIMIT_PATTERN = /rate.?limit|too many requests|quota|resource.?exhausted/i;
const FATAL_PATTERN = /not configured|invalid api key|api key not valid|incorrect api key|unauthorized|authentication/i;
const TRANSIENT_PATTERN = /timeout|timed out|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|socket hang up|fetch failed|network|overloaded|connection closed|target closed/i;
const STATUS_IN_MESSAGE = /\b([45]\d{2})\b/;

const HTTP_UNAUTHORIZED = 401;
const HTTP_REQUEST_TIMEOUT = 408;
const HTTP_TOO_EARLY = 425;
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_CLIENT_ERROR_MIN = 400;
const HTTP_SERVER_ERROR_MIN = 500;

interface ErrorLike {
  status?: unknown;
  statusCode?: unknown;
  message?: unknown;
}

/** HTTP status from SDK errors (`status`/`statusCode`) or from messages like "failed: 400 Bad Request". */
export function extractHttpStatus(err: unknown): number | undefined {
  const e = (err ?? {}) as ErrorLike;
  for (const candidate of [e.status, e.statusCode]) {
    if (typeof candidate === 'number') return candidate;
  }
  const match = String(e.message ?? '').match(STATUS_IN_MESSAGE);
  return match ? Number(match[1]) : undefined;
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Unknown errors are treated as TRANSIENT, matching the previous retry-everything behaviour. */
export function classifyFailure(err: unknown): FailureKind {
  const message = errorMessage(err);
  const status = extractHttpStatus(err);

  if (status === HTTP_TOO_MANY_REQUESTS || RATE_LIMIT_PATTERN.test(message)) return FailureKind.RATE_LIMITED;
  if (status === HTTP_UNAUTHORIZED || FATAL_PATTERN.test(message)) return FailureKind.FATAL;
  if (status === HTTP_REQUEST_TIMEOUT || status === HTTP_TOO_EARLY) return FailureKind.TRANSIENT;
  if (status !== undefined && status >= HTTP_SERVER_ERROR_MIN) return FailureKind.TRANSIENT;
  if (status !== undefined && status >= HTTP_CLIENT_ERROR_MIN) return FailureKind.PERMANENT;
  if (TRANSIENT_PATTERN.test(message)) return FailureKind.TRANSIENT;
  return FailureKind.TRANSIENT;
}

export function isRetryable(kind: FailureKind): boolean {
  return kind === FailureKind.RATE_LIMITED || kind === FailureKind.TRANSIENT;
}
