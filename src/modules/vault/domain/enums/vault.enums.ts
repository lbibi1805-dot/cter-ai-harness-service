/** Outcome of removing a file's chunks from the vector index. */
export enum VectorSyncResult {
  OK = 'ok',
  SKIP = 'skip',
  /** Some step failed: the row stays `deleting` and the reconciler finishes the job. */
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

/**
 * Lifecycle of a manifest row. Deleting is a committed state, not a single
 * command: a crash mid-delete leaves the row `deleting` and the next run resumes.
 */
export enum VaultEntryStatus {
  ACTIVE = 'active',
  /** A new version is uploaded; its vectors are not live yet (the previous ones still are). */
  INDEXING = 'indexing',
  /** Vectors + objects are being removed; the row goes away last. */
  DELETING = 'deleting',
  /** The last indexing attempt failed (`lastError`); the previous version stays live. */
  FAILED = 'failed',
}

export enum VaultSourceType {
  MARKDOWN = 'md',
}

/** Outcome of uploading one file. */
export enum VaultUploadOutcome {
  /** Same content as stored: no object put, no re-embedding. */
  UNCHANGED = 'unchanged',
  CREATED = 'created',
  UPDATED = 'updated',
}
