import type { CitedChunk } from './retrieval.interface';

/** One indexed version of a vault document, as the BM25 corpus sees it. */
export interface LexicalDocumentRef {
  docId: string;
  /** Content hash of the version whose chunks are live in the vector index (chunk ids derive from it). */
  hash: string;
  filePath: string;
  objectKey: string;
}

/**
 * Where the in-RAM BM25 index reads vault documents from (implemented by the vault module): the manifest
 * comes from RAM and contents from object storage — never from the database.
 */
export interface LexicalCorpus {
  /** Null until the manifest is in memory (nothing is read before that). */
  liveDocuments(): LexicalDocumentRef[] | null;
  /** The document's markdown; null when the object is missing. */
  readContent(ref: LexicalDocumentRef): Promise<string | null>;
}

export interface LexicalSearchOptions {
  /** Keeps only chunks whose vault path passes (e.g. a `_exemplars/<course>/` prefix). */
  sourceFilter?: (source: string) => boolean;
}

/** Keyword (BM25) search over the vault chunks; results carry the same chunk ids as the vector index. */
export interface LexicalSearch {
  search(query: string, limit: number, options?: LexicalSearchOptions): CitedChunk[];
}

/** Outcome of one corpus sync. */
export interface LexicalSyncReport {
  documents: number;
  chunks: number;
  added: number;
  removed: number;
  failed: number;
}
