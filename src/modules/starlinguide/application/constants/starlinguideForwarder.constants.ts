/** Defaults of the STARLINGUIDE_* settings (planning-15112026-starlinguide-push). */
export const DEFAULT_STARLINGUIDE_FLUSH_DELAY_MS = 5_000;
export const DEFAULT_STARLINGUIDE_TIMEOUT_MS = 120_000;

/** Even while photos keep coming, the first one waits at most this long. */
export const STARLINGUIDE_MAX_BATCH_WAIT_MS = 30_000;
/** Photos waiting at once (metadata only: bytes are read from storage right before sending). */
export const STARLINGUIDE_MAX_PENDING_FILES = 200;

/** Pair retries (`INTERNAL_SERVER_ERROR`): one delay per attempt. */
export const STARLINGUIDE_PAIR_RETRY_DELAYS_MS: readonly number[] = [10_000, 60_000, 300_000];
/** Whole-request retries (5xx, network): one delay per attempt. */
export const STARLINGUIDE_REQUEST_RETRY_DELAYS_MS: readonly number[] = [5_000, 30_000, 120_000];
/** A timeout may mean the partner saved the files: resend once only (duplicates are possible). */
export const STARLINGUIDE_MAX_TIMEOUT_RETRIES = 1;
/** 429 without a usable Retry-After. */
export const STARLINGUIDE_DEFAULT_RETRY_AFTER_SECONDS = 60;
/** "Library full" warnings: once per email per hour. */
export const STARLINGUIDE_LIBRARY_FULL_WARN_INTERVAL_MS = 60 * 60 * 1000;
/** On SIGTERM: time left to send what is still waiting. */
export const STARLINGUIDE_SHUTDOWN_GRACE_MS = 8_000;

export const STARLINGUIDE_LOG_PREFIX = '[starlinguide]';
