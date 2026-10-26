import type { CanvasAccountConfig } from '../../../../shared/canvas/interfaces/canvasAccount.interface';
import { SchedulerState, type PollCursorRepository, type PollJob, type PollJobName } from '../../domain';

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
