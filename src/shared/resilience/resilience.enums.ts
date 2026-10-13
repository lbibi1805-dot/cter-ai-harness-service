/** How a failed call to an external service should be handled. */
export enum FailureKind {
  /** 429 / quota — back off, then prefer switching to another target (model). */
  RATE_LIMITED = 'rate-limited',
  /** 5xx, timeouts, network blips — retry the same target with backoff. */
  TRANSIENT = 'transient',
  /** 4xx for this request/target — retrying the same target cannot help. */
  PERMANENT = 'permanent',
  /** Credentials/configuration are wrong — nothing will succeed until fixed. */
  FATAL = 'fatal',
}
