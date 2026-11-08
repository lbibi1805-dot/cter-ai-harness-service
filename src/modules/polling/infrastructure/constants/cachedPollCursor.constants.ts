/** POLL_CURSOR_FLUSH_MS default: a crash loses at most 15 minutes of cursor progress (re-listed and deduplicated downstream). */
export const DEFAULT_POLL_CURSOR_FLUSH_MS = 15 * 60 * 1000;

/** Signals that trigger the shutdown cursor flush (Render sends SIGTERM on deploy/restart; Ctrl+C sends SIGINT). */
export const SHUTDOWN_SIGNALS: readonly NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];

/** Upper bound for the shutdown flush, well inside the host's grace period. */
export const SHUTDOWN_FLUSH_TIMEOUT_MS = 10_000;
