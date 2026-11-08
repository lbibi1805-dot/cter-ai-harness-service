import { errorMessage } from '../../../shared/errors';
import { logger } from '../../../shared/logging/logger';
import { attempt } from '../../../shared/resilience/attempt';
import type { PollCursorEntry, PollCursorRepository, PollJobName } from '../domain';
import { cursorKey } from './helpers/filePollCursor.helper';
import { CachedPollCursorOptions, PollCursorCacheStats } from './interfaces/cachedPollCursor.interface';

/**
 * Keeps poll cursors in RAM so the 30 s poller does not keep Neon awake:
 * `get` reads the store once per (job, account), `save` only updates RAM and
 * schedules ONE flush at most every `flushIntervalMs`. The flush timer exists
 * only while something is dirty, so an idle poller never wakes the database.
 * Call `flush()` on shutdown (SIGTERM) to persist the latest progress.
 */
export class CachedPollCursorRepository implements PollCursorRepository {
  private readonly cache = new Map<string, Date | null>();
  private readonly loading = new Map<string, Promise<Date | null>>();
  private readonly dirty = new Map<string, PollCursorEntry>();
  private readonly now: () => number;
  private readonly setTimer: NonNullable<CachedPollCursorOptions['setTimer']>;
  private readonly clearTimer: NonNullable<CachedPollCursorOptions['clearTimer']>;
  private timer: unknown = null;
  private timerDueAt: number | null = null;
  private lastFlushAt: number | null = null;
  private lastFlushError: string | null = null;
  private flushing: Promise<void> | null = null;
  private storeReads = 0;
  private flushCount = 0;

  constructor(
    private readonly inner: PollCursorRepository,
    private readonly options: CachedPollCursorOptions,
  ) {
    this.now = options.now ?? Date.now;
    this.setTimer = options.setTimer ?? ((callback, ms) => {
      const handle = setTimeout(callback, ms);
      handle.unref?.();
      return handle;
    });
    this.clearTimer = options.clearTimer ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  }

  async get(job: PollJobName, accountIndex: number): Promise<Date | null> {
    const key = cursorKey(job, accountIndex);
    if (this.cache.has(key)) return this.cache.get(key) ?? null;
    let pending = this.loading.get(key);
    if (!pending) {
      this.storeReads++;
      pending = this.inner.get(job, accountIndex).finally(() => this.loading.delete(key));
      this.loading.set(key, pending);
    }
    const stored = await pending;
    // A save that raced the first read wins when it is newer.
    if (!this.cache.has(key)) this.cache.set(key, stored);
    return this.cache.get(key) ?? null;
  }

  async save(job: PollJobName, accountIndex: number, cursor: Date): Promise<void> {
    const key = cursorKey(job, accountIndex);
    const current = this.cache.get(key);
    if (current && current >= cursor) return;
    this.cache.set(key, cursor);
    this.dirty.set(key, { job, accountIndex, cursor });
    this.scheduleFlush();
  }

  /** Writes every dirty cursor now (one batch); a no-op — no database call — when nothing changed. */
  async flush(): Promise<void> {
    while (this.flushing) await this.flushing;
    this.cancelTimer();
    if (this.dirty.size === 0) return;
    this.flushing = this.writeDirty().finally(() => {
      this.flushing = null;
    });
    await this.flushing;
    if (this.dirty.size > 0) this.scheduleFlush();
  }

  stats(): PollCursorCacheStats {
    return {
      flushIntervalMs: this.options.flushIntervalMs,
      storeReads: this.storeReads,
      flushCount: this.flushCount,
      lastFlushAt: this.lastFlushAt === null ? null : new Date(this.lastFlushAt).toISOString(),
      lastFlushError: this.lastFlushError,
      dirtyCount: this.dirty.size,
      dirty: [...this.dirty.values()].map((e) => ({ job: e.job, accountIndex: e.accountIndex, cursor: e.cursor.toISOString() })),
      nextFlushAt: this.timerDueAt === null ? null : new Date(this.timerDueAt).toISOString(),
    };
  }

  private async writeDirty(): Promise<void> {
    const batch = [...this.dirty.values()];
    this.lastFlushAt = this.now();
    const written = await attempt(async () => {
      if (this.inner.saveMany) await this.inner.saveMany(batch);
      else for (const e of batch) await this.inner.save(e.job, e.accountIndex, e.cursor);
    });
    if (!written.ok) {
      this.lastFlushError = errorMessage(written.error);
      logger.warn(`[poll] cursor flush failed (${batch.length} cursor(s) kept in RAM, retry in ${this.options.flushIntervalMs}ms): ${this.lastFlushError}`);
      return;
    }
    this.flushCount++;
    this.lastFlushError = null;
    // Only clear what was written: a newer cursor saved meanwhile stays dirty.
    for (const e of batch) {
      const key = cursorKey(e.job, e.accountIndex);
      if (this.dirty.get(key) === e) this.dirty.delete(key);
    }
  }

  /** At most one pending timer; the first flush after boot runs right away, later ones once per interval. */
  private scheduleFlush(): void {
    if (this.timer !== null || this.flushing) return;
    const dueAt = this.lastFlushAt === null ? this.now() : this.lastFlushAt + this.options.flushIntervalMs;
    this.timerDueAt = dueAt;
    this.timer = this.setTimer(() => {
      this.timer = null;
      this.timerDueAt = null;
      void this.flush();
    }, Math.max(0, dueAt - this.now()));
  }

  private cancelTimer(): void {
    if (this.timer === null) return;
    this.clearTimer(this.timer);
    this.timer = null;
    this.timerDueAt = null;
  }
}
