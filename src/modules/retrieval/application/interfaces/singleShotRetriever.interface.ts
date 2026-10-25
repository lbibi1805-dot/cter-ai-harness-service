import type { RAGRetriever } from '../ragRetriever.service';

export interface SingleShotRetrieverSource {
  /** RAG_TOP_K: chunks used when reranking is off or fails. */
  defaultTopK: number;
  createRetriever(topK: number): RAGRetriever;
}
