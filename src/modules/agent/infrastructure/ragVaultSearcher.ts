import { createEmbeddingService, RAGRetriever } from '../../../rag';
import type { AppConfig, CitedChunk, VaultConfig } from '../../../types';
import type { ChunkRetriever, RerankModule } from '../../rerank';
import type { VaultSearcher } from './tools/vaultSearch.tool';

/** Candidates fetched per search before the optional folder filter trims them. */
export const AGENT_SEARCH_CANDIDATES = 10;

/**
 * Pinecone-backed search with its own small top-k (the single-shot path uses
 * RAG_TOP_K). With reranking on, it fetches the wider candidate list and keeps
 * the reranker's best AGENT_SEARCH_CANDIDATES. Built lazily so a missing
 * embedding key only fails the agent call — which then falls back — instead of
 * the whole service at startup.
 */
export class RagVaultSearcher implements VaultSearcher {
  private retriever: ChunkRetriever | null = null;

  constructor(
    private readonly vaultConfig: VaultConfig,
    private readonly aiKeys: AppConfig['aiKeys'],
    private readonly ranking?: RerankModule,
  ) {}

  search(query: string): Promise<CitedChunk[]> {
    return this.getRetriever().retrieve(query);
  }

  private getRetriever(): ChunkRetriever {
    if (!this.retriever) {
      const embedder = createEmbeddingService(this.vaultConfig.embeddingProvider, { gemini: this.aiKeys.gemini, openai: this.aiKeys.openai });
      const topK = this.ranking?.candidateCount(AGENT_SEARCH_CANDIDATES) ?? AGENT_SEARCH_CANDIDATES;
      const vectorRetriever = new RAGRetriever({ ...this.vaultConfig, topK }, embedder);
      this.retriever = this.ranking
        ? this.ranking.wrap(vectorRetriever, { topN: AGENT_SEARCH_CANDIDATES, fallbackTopK: AGENT_SEARCH_CANDIDATES, label: 'agent' })
        : vectorRetriever;
    }
    return this.retriever;
  }
}
