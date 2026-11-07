import type { VaultUploadOutcome, VectorChunkMetadata, VectorSyncResult, VaultEntry } from '../../domain';

export interface Page {
  limit: number;
  offset: number;
}

export interface VaultUpload {
  rawName: string;
  content: string;
}

export type VaultUploadResult =
  | { file: string; hash: string; indexed: boolean; outcome: VaultUploadOutcome }
  | { file: string; error: string };

export interface VaultChunkView extends Partial<VectorChunkMetadata> {
  id: string;
  index: number;
  indexed: boolean;
}

export interface FileChunksResult {
  total: number;
  chunks: VaultChunkView[];
}

export interface ChunkIdsResult {
  total: number;
  chunkIds: string[];
}

/** A file with its current content (read from object storage). */
export interface VaultFileView extends VaultEntry {
  /** Empty when the object is missing (legacy row → re-upload). */
  content: string;
}

/** Outcome of a delete: `pending` > 0 means some cleanup failed and the reconciler will finish it. */
export interface VaultDeleteResult {
  deleted: number;
  pending: number;
  vectors: VectorSyncResult;
}

export interface ReconcileReport {
  /** Rows found in `deleting` and finished now. */
  deletesResumed: number;
  deletesStillPending: number;
  orphanVectorsDeleted: number;
  orphanObjectsDeleted: number;
  /** Files whose latest content is not indexed yet (re-queued). */
  pendingIndex: number;
  /** Rows without an object (legacy, content in Neon): need a re-upload. */
  legacyRows: number;
  /** Checks that could not run (e.g. vector listing on a pod index). */
  skipped: string[];
}

export interface VaultServiceOptions {
  /** Orphan objects younger than this are kept: an upload may be between `put` and the manifest write. */
  orphanGraceMs: number;
  /** Parallel document purges when deleting a folder. */
  deleteConcurrency: number;
  now: () => number;
}
