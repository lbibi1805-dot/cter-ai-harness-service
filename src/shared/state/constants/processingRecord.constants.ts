import { ProcessingStatus } from '../enums/processingRecord.enums';

/** Statuses that mean "do not pick this item up again". */
export const HANDLED_STATUSES: ReadonlySet<ProcessingStatus> = new Set([
  ProcessingStatus.PROCESSING,
  ProcessingStatus.DONE,
  ProcessingStatus.FAILED,
]);
