import type { VaultDocumentReader, VaultRepository } from '../../vault/domain';
import type { CitationPromptBuilder } from '../application/citationPrompt.builder';
import type { KnowledgeIndexer } from '../application/knowledgeIndexer.service';
import type { LexicalIndexSync } from '../application/lexicalIndexSync.service';
import type { RAGRetriever } from '../application/ragRetriever.service';
import type { EmbeddingService } from '../domain/interfaces/embedding.port';
import type { ChunkGuard, RetrievalConfig } from '../domain/interfaces/retrieval.interface';
import type { VectorStore } from '../domain/interfaces/vectorStore.port';

export interface RetrievalModule {
  config: RetrievalConfig;
  embedder: EmbeddingService;
  vectorStore: VectorStore;
  citations: CitationPromptBuilder;
  /** Vector search returning `topK` chunks (callers widen it when a reranker follows). */
  createRetriever(topK: number): RAGRetriever;
  createIndexer(repository: VaultRepository, documents: VaultDocumentReader): KnowledgeIndexer;
  /** Installs the vault's read-side guard; every retriever created afterwards (and before) applies it. */
  setChunkGuard(guard: ChunkGuard): void;
  /** The vault's read-side guard currently installed (applied by every retriever). */
  guard: ChunkGuard;
  /** BM25 index in RAM (HYBRID_SEARCH_ENABLED); null when hybrid search is off. Fed by the vault module. */
  lexical: LexicalIndexSync | null;
}

export interface RetrievalModuleDeps {
  /** Test hooks. */
  embedder?: EmbeddingService;
  vectorStore?: VectorStore;
}
