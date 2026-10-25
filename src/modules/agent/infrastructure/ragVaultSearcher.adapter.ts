import type { ChunkRetriever, RerankModule } from '../../rerank';
import type { CitedChunk, RetrievalModule } from '../../retrieval';
import { AGENT_SEARCH_CANDIDATES } from '../domain';
import { VaultSearcher } from './interfaces/vaultSearch.interface';

/**
 * Pinecone-backed search with its own small top-k (the single-shot path uses
 * RAG_TOP_K). With reranking on, it fetches the wider candidate list and keeps
 * the reranker's best AGENT_SEARCH_CANDIDATES.
 */
export class RagVaultSearcher implements VaultSearcher {
  private readonly retriever: ChunkRetriever;

  constructor(retrieval: RetrievalModule, ranking?: RerankModule) {
    const vectorRetriever = retrieval.createRetriever(ranking?.candidateCount(AGENT_SEARCH_CANDIDATES) ?? AGENT_SEARCH_CANDIDATES);
    this.retriever = ranking
      ? ranking.wrap(vectorRetriever, { topN: AGENT_SEARCH_CANDIDATES, fallbackTopK: AGENT_SEARCH_CANDIDATES, label: 'agent' })
      : vectorRetriever;
  }

  search(query: string): Promise<CitedChunk[]> {
    return this.retriever.retrieve(query);
  }
}
