/** Outcome of removing a file's chunks from the vector index. */
export enum VectorSyncResult {
  OK = 'ok',
  SKIP = 'skip',
  PARTIAL = 'partial',
}

/** Outcome of a manual re-index request. */
export enum ReindexOutcome {
  STARTED = 'started',
  ALREADY_RUNNING = 'already-running',
  NOT_CONFIGURED = 'not-configured',
}

/** Header value required to clear the whole vault. */
export enum VaultDeleteConfirmation {
  DELETE_ALL = 'delete-all',
}
