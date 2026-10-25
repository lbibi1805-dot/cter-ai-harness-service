import type { CitedChunk } from '../../../retrieval/domain/interfaces/retrieval.interface';
import { buildRerankPassages, passagesPerChunk, type RerankHit } from '../../domain';
import { RRF_K } from '../constants/rerankingRetriever.constants';

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
