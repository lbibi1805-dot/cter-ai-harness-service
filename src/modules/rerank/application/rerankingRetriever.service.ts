import { errorMessage } from '../../../shared/resilience';
import type { CitedChunk } from '../../../types';
import { logger } from '../../../utils/logger';
import { withTimeout } from '../../../utils/withTimeout';
import { buildRerankPassages, passagesPerChunk, truncate, type ChunkRetriever, type Reranker, type RerankHit } from '../domain';

/** Standard reciprocal-rank-fusion constant. */
export const RRF_K = 60;

export interface RerankingOptions {
  /** Chunks returned after reranking. */
  topN: number;
  /** Chunks returned (in cosine order) when the reranker fails or times out. */
  fallbackTopK: number;
  timeoutMs: number;
  maxQueryChars: number;
  maxDocumentChars: number;
  /** Shown in logs: which path asked (single-shot / agent). */
  label: string;
}

/**
 * Decorator over vector retrieval: fetches the inner retriever's (wide)
 * candidate list, reorders it with a cross-encoder and keeps the best `topN`.
 * Reranking is an optimisation, never a dependency: any failure returns the
 * cosine order cut to the legacy top-k, so answers keep flowing.
 */
export class RerankingRetriever implements ChunkRetriever {
  constructor(
    private readonly inner: ChunkRetriever,
    private readonly reranker: Reranker,
    private readonly options: RerankingOptions,
    private readonly now: () => number = Date.now,
  ) {}

  async retrieve(question: string): Promise<CitedChunk[]> {
    const candidates = await this.inner.retrieve(question);
    if (candidates.length <= 1) return candidates;

    const started = this.now();
    try {
      const { documents, owners } = buildRerankRequest(candidates, this.options.maxDocumentChars);
      const topN = Math.min(this.options.topN, candidates.length);
      const hits = await withTimeout(
        // Every passage is scored: a chunk's score is its best passage.
        this.reranker.rerank(truncate(question.trim(), this.options.maxQueryChars), documents, documents.length),
        this.options.timeoutMs,
        `rerank ${this.reranker.model}`,
      );
      const ranked = applyHits(candidates, hits, owners).slice(0, topN);
      if (ranked.length === 0) throw new Error('reranker returned no usable results');
      logger.info(`[rerank] ${this.options.label} — ${candidates.length}→${ranked.length} in ${this.now() - started}ms (top1 ${ranked[0].rerankScore?.toFixed(3)} ${ranked[0].source})`);
      return ranked;
    } catch (err) {
      logger.info(`[rerank] ${this.options.label} — failed after ${this.now() - started}ms (${errorMessage(err)}) — using vector order`);
      return candidates.slice(0, this.options.fallbackTopK);
    }
  }
}

/** Passages to score and, for each, the index of the chunk it came from. */
export function buildRerankRequest(candidates: CitedChunk[], maxDocumentChars: number): { documents: string[]; owners: number[] } {
  const perChunk = passagesPerChunk(candidates.length);
  const documents: string[] = [];
  const owners: number[] = [];
  candidates.forEach((chunk, index) => {
    for (const passage of buildRerankPassages(chunk, maxDocumentChars, perChunk)) {
      documents.push(passage);
      owners.push(index);
    }
  });
  return { documents, owners };
}

/**
 * Maps hits back to chunks, most relevant first. `owners[i]` is the chunk of
 * document i (identity when there is one document per chunk); a chunk scored
 * through several passages keeps its best score. Invalid indexes are ignored.
 */
export function applyHits(candidates: CitedChunk[], hits: RerankHit[], owners?: number[]): CitedChunk[] {
  const best = new Map<number, number>();
  for (const hit of hits) {
    if (!Number.isInteger(hit.index) || hit.index < 0) continue;
    const owner = owners ? owners[hit.index] : hit.index;
    if (owner === undefined || owner >= candidates.length) continue;
    if (!best.has(owner) || hit.score > best.get(owner)!) best.set(owner, hit.score);
  }
  return [...best.entries()]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .map(([owner, score]) => ({ ...candidates[owner], rerankScore: score }));
}

/**
 * Reciprocal-rank fusion of the reranked order and the original vector order:
 * score = 1/(k + rerankRank) + 1/(k + vectorRank). Keeps a chunk the reranker
 * scored poorly from falling far when the vector search was confident about it.
 */
export function fuseWithVectorOrder(reranked: CitedChunk[], candidates: CitedChunk[], k = RRF_K): CitedChunk[] {
  const vectorRank = new Map(candidates.map((c, i) => [c.chunkId, i + 1]));
  return reranked
    .map((chunk, i) => ({ chunk, score: 1 / (k + i + 1) + 1 / (k + (vectorRank.get(chunk.chunkId) ?? candidates.length + 1)) }))
    .sort((a, b) => b.score - a.score)
    .map(({ chunk }) => chunk);
}
