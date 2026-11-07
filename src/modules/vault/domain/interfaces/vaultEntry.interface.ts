import type { VaultEntryStatus, VaultSourceType } from '../enums/vault.enums';

/**
 * One vault file in the manifest (Neon is the source of truth). The bytes live
 * in object storage at `objectKey`; the manifest only keeps ids and state.
 *
 * Two versions can coexist while a file is being re-indexed:
 * - `hash` / `objectKey`: the latest uploaded content (what `read_document` returns);
 * - `indexedHash` / `chunkIds`: the content whose vectors are live for RAG.
 * The file is fully in sync when `indexedHash === hash`.
 */
export interface VaultEntry {
  filePath: string;
  /** Stable id from the first upload; survives edits and renames. Prefix of every chunk id and object key. */
  docId: string;
  /** md5 of the normalized content: the change-detection key. */
  hash: string;
  objectKey: string;
  chunkIds: string[];
  indexed: boolean;
  /** Hash of the content behind `chunkIds`; null before the first successful index. */
  indexedHash: string | null;
  status: VaultEntryStatus;
  sourceType: VaultSourceType;
  contentType: string;
  sizeBytes: number | null;
  lastError: string | null;
  updatedAt: string;
  folderPath?: string;
  depth?: number;
}

/** A new content version written by an upload (indexing starts from here). */
export interface VaultVersion {
  filePath: string;
  docId: string;
  hash: string;
  objectKey: string;
  sourceType: VaultSourceType;
  contentType: string;
  sizeBytes: number;
}

/** Result of a successful embedding run for one document version. */
export interface IndexedVersion {
  docId: string;
  hash: string;
  chunkIds: string[];
}

export interface VaultFolder {
  path: string;
  depth: number;
  fileCount: number;
}

export interface VaultFolderGroup {
  folderPath: string;
  fileCount: number;
}

export interface VaultStats {
  total: number;
  indexed: number;
}
