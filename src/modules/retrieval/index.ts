import { CitationPromptBuilder } from './application/citationPrompt.builder';
import { KnowledgeIndexer } from './application/knowledgeIndexer.service';
import { LexicalIndexSync } from './application/lexicalIndexSync.service';
import { RAGRetriever } from './application/ragRetriever.service';
import type { ChunkGuard, EmbeddingKeys, RetrievalConfig } from './domain/interfaces/retrieval.interface';
import { createEmbeddingService } from './infrastructure/embedding.factory';
import { PineconeVectorStore } from './infrastructure/pineconeVectorStore.adapter';
import { MiniSearchLexicalIndex } from './infrastructure/miniSearchLexicalIndex.adapter';
import { DEFAULT_HYBRID_SEARCH_ENABLED } from './domain/constants/hybridSearch.constants';
import type { RetrievalModule, RetrievalModuleDeps } from './interfaces/retrievalModule.interface';

export type { RetrievalModule, RetrievalModuleDeps } from './interfaces/retrievalModule.interface';

/** Wires embeddings + Pinecone. Only built when a Pinecone key is configured. */
export function createRetrievalModule(config: RetrievalConfig, keys: EmbeddingKeys, deps: RetrievalModuleDeps = {}): RetrievalModule {
  const embedder = deps.embedder ?? createEmbeddingService(config.embeddingProvider, keys);
  const vectorStore = deps.vectorStore ?? new PineconeVectorStore(config.pineconeApiKey, config.pineconeIndex);
  let guard: ChunkGuard = (chunks) => chunks;
  const lexical = (config.hybridSearch ?? DEFAULT_HYBRID_SEARCH_ENABLED) ? new LexicalIndexSync(new MiniSearchLexicalIndex()) : null;
  const guarded: ChunkGuard = (chunks) => guard(chunks);
  return {
    config,
    embedder,
    vectorStore,
    citations: new CitationPromptBuilder(),
    createRetriever: (topK) => new RAGRetriever(vectorStore, embedder, topK, guarded, config.minScore, lexical ?? undefined),
    createIndexer: (repository, documents) => new KnowledgeIndexer(config, embedder, repository, vectorStore, documents),
    setChunkGuard: (next) => { guard = next; },
    guard: guarded,
    lexical,
  };
}

export { CitationPromptBuilder } from './application/citationPrompt.builder';
export { KnowledgeIndexer } from './application/knowledgeIndexer.service';
export { RAGRetriever } from './application/ragRetriever.service';
export { LexicalIndexSync } from './application/lexicalIndexSync.service';
export { MiniSearchLexicalIndex } from './infrastructure/miniSearchLexicalIndex.adapter';
export { reciprocalRankFusion, stripDiacritics } from './domain/helpers/hybridSearch.helper';
export * from './domain/constants/hybridSearch.constants';
export type { LexicalCorpus, LexicalDocumentRef, LexicalSearch, LexicalSearchOptions, LexicalSyncReport } from './domain/interfaces/lexicalSearch.port';
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
