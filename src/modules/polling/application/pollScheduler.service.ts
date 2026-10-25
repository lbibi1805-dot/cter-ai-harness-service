import type { CanvasAccountConfig } from '../../../shared/canvas/interfaces/canvasAccount.interface';
import { errorMessage } from '../../../shared/errors';
import { logger } from '../../../shared/logging/logger';
import { attempt, attemptSync } from '../../../shared/resilience/attempt';
import {
  SchedulerState,
  StartOutcome,
  StopOutcome,
  type PollJob,
} from '../domain';
import { TickReport, PollSchedulerOptions, SchedulerStatus, JobFailure } from './interfaces/pollScheduler.interface';

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
    const inFlight = this.inFlight;
    if (inFlight) await attempt(() => inFlight);
  }

  /** Returns null when the previous tick is still running (the tick is skipped). */
  async runTick(): Promise<TickReport | null> {
    if (this.ticking) {
      this.skippedTicks++;
      return null;
    }
    this.ticking = true;
    const inFlight = this.executeTick();
    this.inFlight = inFlight;
    const tick = await attempt(() => inFlight);
    this.inFlight = null;
    if (!tick.ok) throw tick.error;
    return tick.value;
  }

  private async executeTick(): Promise<TickReport> {
    const startedAt = new Date();
    const failures: JobFailure[] = [];
    this.tickCount++;
    logger.interval(this.tickCount);
    const beforeTick = attemptSync(() => this.options.beforeTick?.());
    if (!beforeTick.ok) logger.warn(`[poll] beforeTick failed: ${errorMessage(beforeTick.error)}`);
    for (const account of this.options.accounts) {
      for (const job of this.options.jobs) {
        const failure = await this.runJob(job, account);
        if (failure) failures.push(failure);
      }
    }
    this.ticking = false;
    const report = { tick: this.tickCount, startedAt: startedAt.toISOString(), durationMs: Date.now() - startedAt.getTime(), failures };
    this.lastTick = report;
    if (report.durationMs > this.options.intervalMs) {
      logger.info(`[poll] tick ${report.tick} took ${report.durationMs}ms (> interval ${this.options.intervalMs}ms) — consider a longer POLL_INTERVAL_MS`);
    }
    return report;
  }

  /** The job error boundary: one (job, account) failing never stops the others; its cursor stays put. */
  private async runJob(job: PollJob, account: CanvasAccountConfig): Promise<JobFailure | null> {
    const run = await attempt(() => this.runAndAdvanceCursor(job, account));
    if (run.ok) return null;
    const error = errorMessage(run.error);
    logger.warn(`[poll] ${job.name} failed for account #${account.index}: ${error} — cursor kept, will retry next tick`);
    return { job: job.name, accountIndex: account.index, error };
  }

  private async runAndAdvanceCursor(job: PollJob, account: CanvasAccountConfig): Promise<void> {
    const cursor = await this.readCursor(job, account);
    const { nextCursor } = await job.run(account, { cursor });
    if (nextCursor && (!cursor || nextCursor > cursor)) await this.options.cursors.save(job.name, account.index, nextCursor);
  }

  /** A cursor store outage degrades to a full listing (deduplicated downstream), not a skipped job. */
  private async readCursor(job: PollJob, account: CanvasAccountConfig): Promise<Date | null> {
    const read = await attempt(() => this.options.cursors.get(job.name, account.index));
    if (read.ok) return read.value;
    logger.warn(`[poll] cursor read failed for ${job.name}#${account.index}: ${errorMessage(read.error)} — full listing`);
    return null;
  }
}
