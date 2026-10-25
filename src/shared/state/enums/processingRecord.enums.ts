/** Lifecycle of one Canvas item (file or chat request) in the local processing state. */
export enum ProcessingStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  DONE = 'done',
  FAILED = 'failed',
}
