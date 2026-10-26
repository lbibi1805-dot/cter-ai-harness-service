import type { CitedChunk } from './retrieval.interface';

export interface ChunkSource {
  retrieve(question: string): Promise<CitedChunk[]>;
}

export interface RerankWrapOptions {
  /** Chunks the caller wants back. */
  topN: number;
  /** Chunks returned in vector order when reranking fails. */
  fallbackTopK: number;
  /** Shown in logs. */
  label: string;
}

/** What retrieval needs from the rerank module (implemented by RerankModule). */
export interface CandidateReranker {
  readonly enabled: boolean;
  /** Vector top-k to fetch so the reranker has enough candidates. */
  candidateCount(topK: number): number;
  /** Returns `inner` unchanged when reranking is off. */
  wrap(inner: ChunkSource, options: RerankWrapOptions): ChunkSource;
}
