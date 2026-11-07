import type { ChunkGuard, CitedChunk } from '../../retrieval/domain/interfaces/retrieval.interface';
import { VaultEntryStatus, type VaultEntry } from '../domain';

/** What the guard needs: a synchronous, in-memory view of the manifest. */
export interface ManifestLookup {
  isLoaded(): boolean;
  peekByDocId(docId: string): VaultEntry | undefined;
}

/**
 * Read-side guard for RAG: the manifest (in RAM) decides what is visible, so
 * a user never sees content of a deleted file or of a superseded version,
 * even while its vectors still wait for cleanup. A renamed file's chunks get
 * the current path. Legacy vectors (no docId) pass unchanged.
 */
export function createVaultChunkGuard(manifest: ManifestLookup): ChunkGuard {
  return (chunks: CitedChunk[]) => {
    if (!manifest.isLoaded()) return chunks;
    return chunks.flatMap((chunk) => {
      if (!chunk.docId) return [chunk];
      const entry = manifest.peekByDocId(chunk.docId);
      if (!entry || entry.status === VaultEntryStatus.DELETING) return [];
      if (chunk.contentHash && chunk.contentHash !== entry.indexedHash) return [];
      return [entry.filePath === chunk.source ? chunk : { ...chunk, source: entry.filePath }];
    });
  };
}
