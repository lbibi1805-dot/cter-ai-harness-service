import type { CanvasAccountConfig } from '../../../../shared/canvas/interfaces/canvasAccount.interface';
import type { PollJobName } from '../enums/polling.enums';

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
