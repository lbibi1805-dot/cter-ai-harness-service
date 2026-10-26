/** What happened to one Canvas file in a poll tick. */
export enum FileOutcome {
  DONE = 'done',
  FAILED = 'failed',
  SKIPPED = 'skipped',
  /** Not finished (still processing, or result could not be delivered) — retried later. */
  DEFERRED = 'deferred',
}
