import { createEmbeddingService, RAGRetriever } from '../../../rag';
import type { AppConfig, CitedChunk, VaultConfig } from '../../../types';
import type { VaultSearcher } from './tools/vaultSearch.tool';

/** Candidates fetched per search before the optional folder filter trims them. */
export const AGENT_SEARCH_CANDIDATES = 10;

/**
 * Pinecone-backed search with its own small top-k (the single-shot path uses
 * RAG_TOP_K). Built lazily so a missing embedding key only fails the agent
 * call — which then falls back — instead of the whole service at startup.
 */
export class RagVaultSearcher implements VaultSearcher {
  private retriever: RAGRetriever | null = null;

  constructor(
    private readonly vaultConfig: VaultConfig,
    private readonly aiKeys: AppConfig['aiKeys'],
  ) {}

  search(query: string): Promise<CitedChunk[]> {
    return this.getRetriever().retrieve(query);
  }

  private getRetriever(): RAGRetriever {
    if (!this.retriever) {
      const embedder = createEmbeddingService(this.vaultConfig.embeddingProvider, { gemini: this.aiKeys.gemini, openai: this.aiKeys.openai });
      this.retriever = new RAGRetriever({ ...this.vaultConfig, topK: AGENT_SEARCH_CANDIDATES }, embedder);
    }
    return this.retriever;
  }
}
