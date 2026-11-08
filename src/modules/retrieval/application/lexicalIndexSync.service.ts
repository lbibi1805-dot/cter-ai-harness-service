import { errorMessage } from '../../../shared/errors';
import { logger } from '../../../shared/logging/logger';
import { attempt } from '../../../shared/resilience/attempt';
import { chunkId, computeContentHash } from '../../vault/domain';
import { LEXICAL_SIGNATURE_SEPARATOR, LEXICAL_SYNC_RETRY_MS } from '../domain/constants/hybridSearch.constants';
import type { LexicalCorpus, LexicalDocumentRef, LexicalSearch, LexicalSearchOptions, LexicalSyncReport } from '../domain/interfaces/lexicalSearch.port';
import type { CitedChunk } from '../domain/interfaces/retrieval.interface';
import { chunkDocument } from '../domain/markdownChunker';
import { normalizeText } from '../domain/textNormalizer';
import type { MiniSearchLexicalIndex } from '../infrastructure/miniSearchLexicalIndex.adapter';

function signatureOf(documents: LexicalDocumentRef[]): string {
  return documents.map((doc) => `${doc.docId}:${doc.hash}`).sort().join(LEXICAL_SIGNATURE_SEPARATOR);
}

/**
 * Keeps the in-RAM BM25 index in line with the vault manifest. A full sync runs once at startup (after the
 * RAG warmup); afterwards every search compares the manifest signature (RAM only) and, when it changed
 * (upload indexed, file deleted or renamed), re-syncs in the background — only changed documents are read
 * from object storage. Never touches the database. Chunking is the indexer's, so ids match Pinecone.
 */
export class LexicalIndexSync implements LexicalSearch {
  private corpus: LexicalCorpus | null = null;
  private running: Promise<LexicalSyncReport | null> | null = null;
  private syncedSignature: string | null = null;
  private retryAfter = 0;

  constructor(
    private readonly index: MiniSearchLexicalIndex,
    private readonly now: () => number = Date.now,
  ) {}

  get chunkCount(): number {
    return this.index.chunkCount;
  }

  /** Installed by the vault module (it owns the manifest and the object storage). */
  setCorpus(corpus: LexicalCorpus): void {
    this.corpus = corpus;
  }

  search(query: string, limit: number, options?: LexicalSearchOptions): CitedChunk[] {
    this.refreshIfChanged();
    return this.index.search(query, limit, options);
  }

  /** Brings the index in line with the manifest; concurrent calls share one run. Null when the manifest is not loaded. */
  sync(): Promise<LexicalSyncReport | null> {
    if (!this.running) {
      this.running = this.runSync().finally(() => {
        this.running = null;
      });
    }
    return this.running;
  }

  private refreshIfChanged(): void {
    const documents = this.corpus?.liveDocuments();
    if (!documents || this.running || this.now() < this.retryAfter) return;
    if (signatureOf(documents) === this.syncedSignature) return;
    void this.sync().catch((err) => logger.warn(`[bm25] background sync failed: ${errorMessage(err)}`));
  }

  private async runSync(): Promise<LexicalSyncReport | null> {
    const documents = this.corpus?.liveDocuments();
    if (!this.corpus || !documents) return null;
    const live = new Set(documents.map((doc) => doc.docId));
    let removed = 0;
    for (const docId of this.index.docIds()) {
      if (live.has(docId)) continue;
      this.index.removeDocument(docId);
      removed++;
    }
    let added = 0;
    let failed = 0;
    for (const doc of documents) {
      if (this.index.hashOf(doc.docId) === doc.hash) continue;
      const loaded = await attempt(() => this.load(this.corpus!, doc));
      if (loaded.ok && loaded.value) {
        added++;
        continue;
      }
      failed++;
      this.index.removeDocument(doc.docId);
      logger.warn(`[bm25] ${doc.filePath} not indexed: ${loaded.ok ? 'content missing or changed' : errorMessage(loaded.error)}`);
    }
    if (failed > 0) this.retryAfter = this.now() + LEXICAL_SYNC_RETRY_MS;
    else this.syncedSignature = signatureOf(documents);
    return { documents: this.index.documentCount, chunks: this.index.chunkCount, added, removed, failed };
  }

  /** False when the stored object is not the indexed version (re-index in progress) or is missing. */
  private async load(corpus: LexicalCorpus, doc: LexicalDocumentRef): Promise<boolean> {
    const content = await corpus.readContent(doc);
    if (content === null || computeContentHash(content) !== doc.hash || !content.trim()) return false;
    let index = 0;
    const chunks = chunkDocument(doc.filePath, normalizeText(content), () => chunkId(doc.docId, doc.hash, index++));
    this.index.replaceDocument(doc.docId, doc.hash, chunks.map((chunk) => ({
      chunkId: chunk.id,
      text: chunk.text,
      source: chunk.source,
      heading: chunk.heading,
      parentHeading: chunk.parentHeading,
      tokenCount: chunk.tokenCount,
      docId: doc.docId,
      contentHash: doc.hash,
    })));
    return true;
  }
}
