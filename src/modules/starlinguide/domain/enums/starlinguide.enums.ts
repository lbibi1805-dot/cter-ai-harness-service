/** `results[].error.code` of the Partner API. */
export enum StarlinguideErrorCode {
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',
  CONTEXT_FILE_TOO_LARGE = 'CONTEXT_FILE_TOO_LARGE',
  CONTEXT_FILE_LIMIT = 'CONTEXT_FILE_LIMIT',
  STORAGE_QUOTA_EXCEEDED = 'STORAGE_QUOTA_EXCEEDED',
  INVALID_VALIDATION = 'INVALID_VALIDATION',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  /** Ours: the response had no entry for this (email, file) pair. */
  MISSING_RESULT = 'MISSING_RESULT',
}

/** What to do with one (email, file) result. */
export enum PairOutcome {
  SUCCESS = 'success',
  /** Worth sending again, for this pair only (never the whole request: that would duplicate the others). */
  RETRY = 'retry',
  /** Will not change on retry (wrong email, library full…). */
  PERMANENT = 'permanent',
}

/** How a whole request ended (transport / request-level errors). */
export enum SendStatus {
  OK = 'ok',
  RATE_LIMITED = 'rate_limited',
  UNAUTHORIZED = 'unauthorized',
  BAD_REQUEST = 'bad_request',
  TOO_LARGE = 'too_large',
  /** 5xx: the partner saved nothing, sending again is safe. */
  SERVER = 'server',
  /** No response at all (DNS, connection reset). */
  NETWORK = 'network',
  /** No answer in time: the partner may or may not have saved the files. */
  TIMEOUT = 'timeout',
}
