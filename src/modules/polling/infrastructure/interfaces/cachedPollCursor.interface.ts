export interface CachedPollCursorOptions {
  /** Minimum time between two flushes to the inner store. */
  flushIntervalMs: number;
  now?: () => number;
  setTimer?: (callback: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

/** RAM-only view for `GET /api/metrics/db`. */
export interface PollCursorCacheStats {
  flushIntervalMs: number;
  /** Reads that reached the inner store (one per (job, account) after boot). */
  storeReads: number;
  flushCount: number;
  lastFlushAt: string | null;
  lastFlushError: string | null;
  /** Cursors advanced in RAM but not yet written to the store. */
  dirtyCount: number;
  dirty: Array<{ job: string; accountIndex: number; cursor: string }>;
  nextFlushAt: string | null;
}
