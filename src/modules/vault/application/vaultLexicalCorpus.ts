import type { LexicalCorpus, LexicalDocumentRef } from '../../retrieval/domain/interfaces/lexicalSearch.port';
import { VaultEntryStatus, type VaultEntry, type VaultDocumentReader } from '../domain';

/** What the corpus needs from the manifest: a RAM snapshot that never loads from the database. */
export interface ManifestSnapshot {
  peekAll(): VaultEntry[] | null;
}

/**
 * The vault as the BM25 index sees it: files whose latest content is the indexed one (their chunk ids are
 * live in Pinecone). A file being re-indexed drops out until its new version is committed. Manifest from
 * RAM, content from object storage — zero database queries.
 */
export function createVaultLexicalCorpus(manifest: ManifestSnapshot, documents: VaultDocumentReader): LexicalCorpus {
  return {
    liveDocuments: (): LexicalDocumentRef[] | null => {
      const entries = manifest.peekAll();
      if (!entries) return null;
      return entries
        .filter((entry) => entry.status !== VaultEntryStatus.DELETING && !!entry.objectKey && entry.indexedHash === entry.hash)
        .map((entry) => ({ docId: entry.docId, hash: entry.hash, filePath: entry.filePath, objectKey: entry.objectKey }));
    },
    readContent: (ref) => documents.readContent(ref),
  };
}
