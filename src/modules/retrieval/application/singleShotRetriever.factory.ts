import type { CandidateReranker, ChunkSource } from '../domain/interfaces/candidateReranker.port';
import { SingleShotRetrieverSource } from './interfaces/singleShotRetriever.interface';
import { SINGLE_SHOT_LABEL } from './constants/singleShotRetriever.constants';

/** Single-shot retrieval as production runs it: wide vector search, then (optionally) rerank to `rerankTopN`. */
export function buildSingleShotRetriever(source: SingleShotRetrieverSource, reranker: CandidateReranker, rerankTopN: number): ChunkSource {
  const vectorRetriever = source.createRetriever(reranker.candidateCount(source.defaultTopK));
  return reranker.wrap(vectorRetriever, { topN: rerankTopN, fallbackTopK: source.defaultTopK, label: SINGLE_SHOT_LABEL });
}
