import type { VaultEntry } from './vaultEntry.interface';

/** Reads a vault file's current content from object storage (the indexer, `read_document`, the API). */
export interface VaultDocumentReader {
  /** Null when the file has no stored object (legacy row) or the object is missing. */
  readContent(entry: Pick<VaultEntry, 'objectKey' | 'filePath'>): Promise<string | null>;
}
