import { describe, it, expect, vi, afterEach } from 'vitest';
import type { CanvasAccountConfig } from '../../../types';
import { PollJobName, SchedulerState, StartOutcome, StopOutcome, type PollCursorRepository, type PollJob } from '../domain';
import { PollSchedulerService } from './pollScheduler.service';

const ACCOUNTS: CanvasAccountConfig[] = [
  { url: 'https://a', apiKey: 'k1', index: 1 },
  { url: 'https://b', apiKey: 'k2', index: 2 },
];

function memoryCursors(): PollCursorRepository & { data: Map<string, Date> } {
  const data = new Map<string, Date>();
  return {
    data,
    get: vi.fn(async (job, account) => data.get(`${job}:${account}`) ?? null),
    save: vi.fn(async (job, account, cursor) => { data.set(`${job}:${account}`, cursor); }),
  };
}

function job(name: PollJobName, run: PollJob['run']): PollJob {
  return { name, run: vi.fn(run) };
}

function scheduler(jobs: PollJob[], cursors = memoryCursors(), beforeTick?: () => void) {
  return new PollSchedulerService({ intervalMs: 1000, accounts: ACCOUNTS, jobs, cursors, beforeTick });
}

describe('PollSchedulerService', () => {
  afterEach(() => vi.useRealTimers());

  it('runs every job for every account', async () => {
    const fileJob = job(PollJobName.FILE_QA, async () => ({ nextCursor: null }));
    const convJob = job(PollJobName.CONVERSATION, async () => ({ nextCursor: null }));
    await scheduler([fileJob, convJob]).runTick();
    expect(fileJob.run).toHaveBeenCalledTimes(2);
    expect(convJob.run).toHaveBeenCalledTimes(2);
  });

  it('isolates failures: one failing (account, job) does not stop the others', async () => {
    const fileJob = job(PollJobName.FILE_QA, async (account) => {
      if (account.index === 1) throw new Error('Canvas 500');
      return { nextCursor: null };
    });
    const convJob = job(PollJobName.CONVERSATION, async () => ({ nextCursor: null }));
    const report = await scheduler([fileJob, convJob]).runTick();
    expect(report!.failures).toEqual([{ job: PollJobName.FILE_QA, accountIndex: 1, error: 'Canvas 500' }]);
    expect(convJob.run).toHaveBeenCalledTimes(2);
    expect(fileJob.run).toHaveBeenCalledTimes(2);
  });

  it('passes the stored cursor and saves only forward moves', async () => {
    const cursors = memoryCursors();
    cursors.data.set('file-qa:1', new Date('2026-10-01T10:00:00Z'));
    const seen: Array<Date | null> = [];
    const fileJob = job(PollJobName.FILE_QA, async (account, { cursor }) => {
      seen.push(cursor);
      return { nextCursor: account.index === 1 ? new Date('2026-10-01T09:00:00Z') : new Date('2026-10-01T11:00:00Z') };
    });
    await scheduler([fileJob], cursors).runTick();
    expect(seen).toEqual([new Date('2026-10-01T10:00:00Z'), null]);
    expect(cursors.data.get('file-qa:1')).toEqual(new Date('2026-10-01T10:00:00Z'));
    expect(cursors.data.get('file-qa:2')).toEqual(new Date('2026-10-01T11:00:00Z'));
  });

  it('keeps the cursor when a job fails', async () => {
    const cursors = memoryCursors();
    await scheduler([job(PollJobName.FILE_QA, async () => { throw new Error('down'); })], cursors).runTick();
    expect(cursors.save).not.toHaveBeenCalled();
  });

  it('falls back to a null cursor when the cursor store is unavailable', async () => {
    const cursors = memoryCursors();
    vi.mocked(cursors.get).mockRejectedValue(new Error('neon down'));
    const fileJob = job(PollJobName.FILE_QA, async () => ({ nextCursor: null }));
    const report = await scheduler([fileJob], cursors).runTick();
    expect(report!.failures).toEqual([]);
    expect(vi.mocked(fileJob.run).mock.calls[0][1]).toEqual({ cursor: null });
  });

  it('never overlaps ticks: a tick that starts while one is running is skipped', async () => {
    let release!: () => void;
    const slow = job(PollJobName.FILE_QA, () => new Promise((resolve) => { release = () => resolve({ nextCursor: null }); }));
    const s = new PollSchedulerService({ intervalMs: 1000, accounts: [ACCOUNTS[0]], jobs: [slow], cursors: memoryCursors() });
    const first = s.runTick();
    await Promise.resolve();
    expect(await s.runTick()).toBeNull();
    release();
    expect(await first).not.toBeNull();
    expect(s.status().skippedTicks).toBe(1);
  });

  it('whenIdle waits for the tick in progress', async () => {
    let release!: () => void;
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => { markStarted = resolve; });
    const slow = job(PollJobName.FILE_QA, () => new Promise((resolve) => {
      release = () => resolve({ nextCursor: null });
      markStarted();
    }));
    const s = new PollSchedulerService({ intervalMs: 1000, accounts: [ACCOUNTS[0]], jobs: [slow], cursors: memoryCursors() });
    await expect(s.whenIdle()).resolves.toBeUndefined();

    void s.runTick();
    await started;
    let idle = false;
    const waiting = s.whenIdle().then(() => { idle = true; });
    await Promise.resolve();
    expect(idle).toBe(false);
    release();
    await waiting;
    expect(idle).toBe(true);
    expect(s.status().lastTick).not.toBeNull();
  });

  it('survives a throwing beforeTick hook', async () => {
    const fileJob = job(PollJobName.FILE_QA, async () => ({ nextCursor: null }));
    await expect(scheduler([fileJob], memoryCursors(), () => { throw new Error('state file locked'); }).runTick()).resolves.not.toBeNull();
    expect(fileJob.run).toHaveBeenCalled();
  });

  it('start runs immediately and then on every interval; stop halts it', async () => {
    vi.useFakeTimers();
    const fileJob = job(PollJobName.FILE_QA, async () => ({ nextCursor: null }));
    const s = new PollSchedulerService({ intervalMs: 1000, accounts: [ACCOUNTS[0]], jobs: [fileJob], cursors: memoryCursors() });

    expect(s.start()).toBe(StartOutcome.STARTED);
    expect(s.start()).toBe(StartOutcome.ALREADY_RUNNING);
    expect(s.status().state).toBe(SchedulerState.RUNNING);
    await vi.advanceTimersByTimeAsync(0);
    expect(fileJob.run).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(3000);
    expect(fileJob.run).toHaveBeenCalledTimes(4);

    expect(s.stop()).toBe(StopOutcome.STOPPED);
    expect(s.stop()).toBe(StopOutcome.ALREADY_STOPPED);
    await vi.advanceTimersByTimeAsync(5000);
    expect(fileJob.run).toHaveBeenCalledTimes(4);
  });
});
