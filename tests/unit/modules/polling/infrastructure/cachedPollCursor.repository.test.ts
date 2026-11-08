import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { CanvasAccountConfig } from '../../../../../src/shared/canvas/interfaces/canvasAccount.interface';
import { PollJobName, type PollJob } from '../../../../../src/modules/polling/domain';
import { PollSchedulerService } from '../../../../../src/modules/polling/application/pollScheduler.service';
import { CachedPollCursorRepository } from '../../../../../src/modules/polling/infrastructure/cachedPollCursor.repository';
import { NeonPollCursorRepository } from '../../../../../src/modules/polling/infrastructure/neonPollCursor.repository';
import { countingSqlClient } from '../../../../../src/shared/database/countingSqlClient';
import { DbQueryCounter } from '../../../../../src/shared/database/dbQueryCounter';
import { PgliteSqlClient } from '../../../../support/pgliteSqlClient';

const FLUSH_MS = 15 * 60 * 1000;
const T1 = new Date('2026-11-01T10:00:00Z');
const T2 = new Date('2026-11-01T11:00:00Z');
const T3 = new Date('2026-11-01T12:00:00Z');
const ACCOUNTS: CanvasAccountConfig[] = [
  { url: 'https://a', apiKey: 'k1', index: 1 },
  { url: 'https://b', apiKey: 'k2', index: 2 },
];

/** Manual clock + timer queue: no real waiting, and the test sees whether any timer is pending at all. */
class ManualTimers {
  now = 1_000_000;
  pending: Array<{ at: number; run: () => void }> = [];
  setTimer = (run: () => void, ms: number) => {
    const entry = { at: this.now + ms, run };
    this.pending.push(entry);
    return entry;
  };
  clearTimer = (handle: unknown) => {
    this.pending = this.pending.filter((e) => e !== handle);
  };
  async advance(ms: number): Promise<void> {
    this.now += ms;
    const due = this.pending.filter((e) => e.at <= this.now);
    this.pending = this.pending.filter((e) => e.at > this.now);
    for (const e of due) e.run();
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

describe('CachedPollCursorRepository (budget: Neon must be able to sleep)', () => {
  let pg: PgliteSqlClient;
  let counter: DbQueryCounter;
  let timers: ManualTimers;

  beforeAll(async () => { pg = new PgliteSqlClient(); });
  afterAll(async () => { await pg.close(); });
  beforeEach(async () => {
    await pg.db.exec('DROP TABLE IF EXISTS poll_cursor');
    counter = new DbQueryCounter();
    timers = new ManualTimers();
  });

  function boot(): CachedPollCursorRepository {
    const neon = new NeonPollCursorRepository(countingSqlClient(pg, counter));
    return new CachedPollCursorRepository(neon, { flushIntervalMs: FLUSH_MS, now: () => timers.now, setTimer: timers.setTimer, clearTimer: timers.clearTimer });
  }

  it('reads each (job, account) once, then N poller ticks cost 0 queries', async () => {
    const cursors = boot();
    const job: PollJob = { name: PollJobName.FILE_QA, run: async () => ({ nextCursor: null }) };
    const scheduler = new PollSchedulerService({ intervalMs: 30_000, accounts: ACCOUNTS, jobs: [job], cursors });
    await scheduler.runTick();
    const afterFirstTick = counter.count();
    expect(afterFirstTick).toBeGreaterThan(0);
    for (let i = 0; i < 50; i++) await scheduler.runTick();
    expect(counter.count()).toBe(afterFirstTick);
    expect(cursors.stats().storeReads).toBe(ACCOUNTS.length);
    expect(timers.pending).toHaveLength(0); // idle: no timer that could wake the database
  });

  it('flushes at most once per interval and only when dirty', async () => {
    const cursors = boot();
    await cursors.get(PollJobName.FILE_QA, 1);
    const base = counter.count();

    await cursors.save(PollJobName.FILE_QA, 1, T1);
    await timers.advance(0); // the first flush after boot runs right away
    expect(cursors.stats().flushCount).toBe(1);
    expect(counter.count()).toBe(base + 1);

    await cursors.save(PollJobName.FILE_QA, 1, T2);
    await cursors.save(PollJobName.FILE_QA, 2, T2);
    await timers.advance(FLUSH_MS - 1);
    expect(cursors.stats()).toMatchObject({ flushCount: 1, dirtyCount: 2 });
    expect(counter.count()).toBe(base + 1);

    await timers.advance(1);
    expect(cursors.stats()).toMatchObject({ flushCount: 2, dirtyCount: 0 });
    expect(counter.count()).toBe(base + 2); // both cursors in ONE batch

    await timers.advance(FLUSH_MS * 4); // nothing changed: no flush, no query, no timer
    expect(cursors.stats().flushCount).toBe(2);
    expect(counter.count()).toBe(base + 2);
    expect(timers.pending).toHaveLength(0);
  });

  it('never moves backwards in RAM, and a restart reads the flushed cursor back', async () => {
    const first = boot();
    await first.save(PollJobName.CONVERSATION, 2, T2);
    await first.save(PollJobName.CONVERSATION, 2, T1);
    expect(await first.get(PollJobName.CONVERSATION, 2)).toEqual(T2);
    await first.flush();

    const restarted = boot();
    expect(await restarted.get(PollJobName.CONVERSATION, 2)).toEqual(T2);
  });

  it('shutdown flush (SIGTERM) persists dirty cursors immediately; a no-op when clean', async () => {
    const cursors = boot();
    await cursors.save(PollJobName.FILE_QA, 1, T1);
    await timers.advance(0);
    await cursors.save(PollJobName.FILE_QA, 1, T3); // dirty, next flush 15 min away
    const before = counter.count();
    await cursors.flush();
    expect(counter.count()).toBe(before + 1);
    expect(cursors.stats().dirtyCount).toBe(0);
    expect(timers.pending).toHaveLength(0);
    await cursors.flush();
    expect(counter.count()).toBe(before + 1);
    expect(await boot().get(PollJobName.FILE_QA, 1)).toEqual(T3);
  });

  it('keeps cursors dirty when the flush fails and retries on the next interval', async () => {
    const cursors = boot();
    await cursors.get(PollJobName.FILE_QA, 1); // schema ready
    pg.failNext();
    await cursors.save(PollJobName.FILE_QA, 1, T1);
    await timers.advance(0);
    expect(cursors.stats()).toMatchObject({ flushCount: 0, dirtyCount: 1 });
    expect(cursors.stats().lastFlushError).toBeTruthy();
    expect(timers.pending).toHaveLength(1);
    await timers.advance(FLUSH_MS);
    expect(cursors.stats()).toMatchObject({ flushCount: 1, dirtyCount: 0, lastFlushError: null });
  });
});
