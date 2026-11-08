import type { PollJobName } from '../enums/polling.enums';

/** One (job, account) watermark. */
export interface PollCursorEntry {
  job: PollJobName;
  accountIndex: number;
  cursor: Date;
}

/** Durable watermark per (job, account) — survives restarts and redeploys. */
export interface PollCursorRepository {
  get(job: PollJobName, accountIndex: number): Promise<Date | null>;
  save(job: PollJobName, accountIndex: number, cursor: Date): Promise<void>;
  /** Optional batch write (one round-trip); callers fall back to `save` per entry. */
  saveMany?(entries: PollCursorEntry[]): Promise<void>;
}
