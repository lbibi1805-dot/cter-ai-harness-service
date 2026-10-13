import type { CanvasAccountConfig } from '../../../types';
import type { PollJobName } from './polling.enums';

export interface PollJobContext {
  /** Last safe watermark for this (job, account); null on the very first run. */
  cursor: Date | null;
}

export interface PollJobResult {
  /** New watermark to persist, or null to keep the current one. */
  nextCursor: Date | null;
}

/** One unit of polling work, run per account on every scheduler tick. */
export interface PollJob {
  readonly name: PollJobName;
  run(account: CanvasAccountConfig, context: PollJobContext): Promise<PollJobResult>;
}

export const KEEP_CURSOR: PollJobResult = { nextCursor: null };
