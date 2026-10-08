import type { PollJobName } from './polling.enums';

/** Durable watermark per (job, account) — survives restarts and redeploys. */
export interface PollCursorRepository {
  get(job: PollJobName, accountIndex: number): Promise<Date | null>;
  save(job: PollJobName, accountIndex: number, cursor: Date): Promise<void>;
}
