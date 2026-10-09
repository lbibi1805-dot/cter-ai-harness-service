import { errorMessage } from '../../../shared/resilience';
import type { CanvasAccountConfig } from '../../../types';
import { logger } from '../../../utils/logger';
import {
  SchedulerState,
  StartOutcome,
  StopOutcome,
  type PollCursorRepository,
  type PollJob,
  type PollJobName,
} from '../domain';

export interface JobFailure {
  job: PollJobName;
  accountIndex: number;
  error: string;
}

export interface TickReport {
  tick: number;
  startedAt: string;
  durationMs: number;
  failures: JobFailure[];
}

export interface SchedulerStatus {
  state: SchedulerState;
  intervalMs: number;
  ticks: number;
  skippedTicks: number;
  lastTick: TickReport | null;
}

export interface PollSchedulerOptions {
  intervalMs: number;
  accounts: CanvasAccountConfig[];
  jobs: PollJob[];
  cursors: PollCursorRepository;
  /** Runs once at the start of every tick (e.g. reset stale processing records). */
  beforeTick?: () => void;
}

/**
 * Owns the polling lifecycle. Ticks never overlap; every (account, job) pair
 * is isolated so one failure cannot stop the others; cursors only move when a
 * job finishes successfully.
 */
export class PollSchedulerService {
  private timer: ReturnType<typeof setInterval> | null = null;
  private ticking = false;
  private inFlight: Promise<TickReport> | null = null;
  private tickCount = 0;
  private skippedTicks = 0;
  private lastTick: TickReport | null = null;

  constructor(private readonly options: PollSchedulerOptions) {}

  isRunning(): boolean {
    return this.timer !== null;
  }

  status(): SchedulerStatus {
    return {
      state: this.isRunning() ? SchedulerState.RUNNING : SchedulerState.STOPPED,
      intervalMs: this.options.intervalMs,
      ticks: this.tickCount,
      skippedTicks: this.skippedTicks,
      lastTick: this.lastTick,
    };
  }

  start(): StartOutcome {
    if (this.isRunning()) return StartOutcome.ALREADY_RUNNING;
    this.timer = setInterval(() => void this.runTick(), this.options.intervalMs);
    logger.info(`Polling started — every ${this.options.intervalMs}ms, jobs: ${this.options.jobs.map((j) => j.name).join(', ')}`);
    void this.runTick();
    return StartOutcome.STARTED;
  }

  stop(): StopOutcome {
    if (!this.timer) return StopOutcome.ALREADY_STOPPED;
    clearInterval(this.timer);
    this.timer = null;
    logger.info('Polling stopped — in-flight jobs will finish');
    return StopOutcome.STOPPED;
  }

  /** Resolves once the tick in progress (if any) has finished — e.g. for a graceful stop. */
  async whenIdle(): Promise<void> {
    await this.inFlight?.catch(() => undefined);
  }

  /** Returns null when the previous tick is still running (the tick is skipped). */
  async runTick(): Promise<TickReport | null> {
    if (this.ticking) {
      this.skippedTicks++;
      return null;
    }
    this.ticking = true;
    this.inFlight = this.executeTick();
    try {
      return await this.inFlight;
    } finally {
      this.inFlight = null;
    }
  }

  private async executeTick(): Promise<TickReport> {
    const startedAt = new Date();
    const failures: JobFailure[] = [];
    try {
      this.tickCount++;
      logger.interval(this.tickCount);
      try {
        this.options.beforeTick?.();
      } catch (err) {
        logger.info(`[poll] beforeTick failed: ${errorMessage(err)}`);
      }
      for (const account of this.options.accounts) {
        for (const job of this.options.jobs) {
          const failure = await this.runJob(job, account);
          if (failure) failures.push(failure);
        }
      }
    } finally {
      this.ticking = false;
    }
    const report = { tick: this.tickCount, startedAt: startedAt.toISOString(), durationMs: Date.now() - startedAt.getTime(), failures };
    this.lastTick = report;
    if (report.durationMs > this.options.intervalMs) {
      logger.info(`[poll] tick ${report.tick} took ${report.durationMs}ms (> interval ${this.options.intervalMs}ms) — consider a longer POLL_INTERVAL_MS`);
    }
    return report;
  }

  private async runJob(job: PollJob, account: CanvasAccountConfig): Promise<JobFailure | null> {
    try {
      const cursor = await this.readCursor(job, account);
      const { nextCursor } = await job.run(account, { cursor });
      if (nextCursor && (!cursor || nextCursor > cursor)) {
        await this.options.cursors.save(job.name, account.index, nextCursor);
      }
      return null;
    } catch (err) {
      logger.info(`[poll] ${job.name} failed for account #${account.index}: ${errorMessage(err)} — cursor kept, will retry next tick`);
      return { job: job.name, accountIndex: account.index, error: errorMessage(err) };
    }
  }

  /** A cursor store outage degrades to a full listing (deduplicated downstream), not a skipped job. */
  private async readCursor(job: PollJob, account: CanvasAccountConfig): Promise<Date | null> {
    try {
      return await this.options.cursors.get(job.name, account.index);
    } catch (err) {
      logger.info(`[poll] cursor read failed for ${job.name}#${account.index}: ${errorMessage(err)} — full listing`);
      return null;
    }
  }
}
