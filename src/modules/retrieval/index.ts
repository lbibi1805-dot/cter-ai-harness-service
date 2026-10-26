import type { VaultRepository } from '../vault/domain';
import { CitationPromptBuilder } from './application/citationPrompt.builder';
import { KnowledgeIndexer } from './application/knowledgeIndexer.service';
import { RAGRetriever } from './application/ragRetriever.service';
import type { EmbeddingService } from './domain/interfaces/embedding.port';
import type { EmbeddingKeys, RetrievalConfig } from './domain/interfaces/retrieval.interface';
import type { VectorStore } from './domain/interfaces/vectorStore.port';
import { createEmbeddingService } from './infrastructure/embedding.factory';
import { PineconeVectorStore } from './infrastructure/pineconeVectorStore.adapter';

export interface RetrievalModule {
  config: RetrievalConfig;
  embedder: EmbeddingService;
  vectorStore: VectorStore;
  citations: CitationPromptBuilder;
  /** Vector search returning `topK` chunks (callers widen it when a reranker follows). */
  createRetriever(topK: number): RAGRetriever;
  createIndexer(repository: VaultRepository): KnowledgeIndexer;
}

export interface RetrievalModuleDeps {
  /** Test hooks. */
  embedder?: EmbeddingService;
  vectorStore?: VectorStore;
}

/** Wires embeddings + Pinecone. Only built when a Pinecone key is configured. */
export function createRetrievalModule(config: RetrievalConfig, keys: EmbeddingKeys, deps: RetrievalModuleDeps = {}): RetrievalModule {
  const embedder = deps.embedder ?? createEmbeddingService(config.embeddingProvider, keys);
  const vectorStore = deps.vectorStore ?? new PineconeVectorStore(config.pineconeApiKey, config.pineconeIndex);
  return {
    config,
    embedder,
    vectorStore,
    citations: new CitationPromptBuilder(),
    createRetriever: (topK) => new RAGRetriever(vectorStore, embedder, topK),
    createIndexer: (repository) => new KnowledgeIndexer(config, embedder, repository, vectorStore),
  };
}

export { CitationPromptBuilder } from './application/citationPrompt.builder';
export { KnowledgeIndexer } from './application/knowledgeIndexer.service';
export { RAGRetriever } from './application/ragRetriever.service';
export { RetrievalQueryService } from './application/retrievalQuery.service';
export { buildSingleShotRetriever } from './application/singleShotRetriever.factory';
export type { CandidateReranker, ChunkSource, RerankWrapOptions } from './domain/interfaces/candidateReranker.port';
export type { EmbeddingService } from './domain/interfaces/embedding.port';
export * from './domain/constants/retrieval.constants';
export * from './domain/enums/retrieval.enums';
export * from './domain/interfaces/retrieval.interface';
export { normalizeText } from './domain/textNormalizer';
export type { VectorStore } from './domain/interfaces/vectorStore.port';
export { createEmbeddingService } from './infrastructure/embedding.factory';
export { PineconeVectorStore } from './infrastructure/pineconeVectorStore.adapter';
export { RetrievalController } from './presentation/retrieval.controller';
export { toRetrieveRequest } from './presentation/mappers/retrieval.mapper';
export { createRetrievalRoutes } from './presentation/retrieval.routes';
export type { RetrievalQueryDeps } from './application/interfaces/retrievalQuery.interface';
export type { RetrieveRequest } from './application/interfaces/retrievalQuery.interface';
export type { SingleShotRetrieverSource } from './application/interfaces/singleShotRetriever.interface';
export { RetrievalApiPath } from './presentation/enums/retrieval.enums';
