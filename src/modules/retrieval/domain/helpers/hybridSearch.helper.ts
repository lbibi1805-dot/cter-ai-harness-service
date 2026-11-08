import {
  COMBINING_MARKS,
  HYBRID_RRF_K,
  PLAIN_D,
  PLAIN_D_UPPER,
  UNICODE_NFC,
  UNICODE_NFD,
  VIETNAMESE_D,
  VIETNAMESE_D_UPPER,
} from '../constants/hybridSearch.constants';
import type { CitedChunk } from '../interfaces/retrieval.interface';

/** Vietnamese without diacritics: NFD, combining marks dropped, đ → d ("Kiểm thử" → "Kiem thu"). */
export function stripDiacritics(text: string): string {
  return text
    .normalize(UNICODE_NFD)
    .replace(COMBINING_MARKS, '')
    .replace(VIETNAMESE_D, PLAIN_D)
    .replace(VIETNAMESE_D_UPPER, PLAIN_D_UPPER)
    .normalize(UNICODE_NFC);
}

/**
 * Reciprocal Rank Fusion: score(chunk) = Σ 1 / (k + rank in list). Chunks are matched by id; the first
 * occurrence is kept, with the vector score / rerank score of any list that has one. Ties keep the
 * earlier list's order (so a single list comes back unchanged).
 */
export function reciprocalRankFusion(lists: CitedChunk[][], k: number = HYBRID_RRF_K): CitedChunk[] {
  const fused = new Map<string, { chunk: CitedChunk; score: number; firstSeen: number }>();
  let seen = 0;
  for (const list of lists) {
    list.forEach((chunk, index) => {
      const contribution = 1 / (k + index + 1);
      const current = fused.get(chunk.chunkId);
      if (!current) {
        fused.set(chunk.chunkId, { chunk, score: contribution, firstSeen: seen++ });
        return;
      }
      current.score += contribution;
      current.chunk = {
        ...current.chunk,
        ...(current.chunk.score === undefined && chunk.score !== undefined ? { score: chunk.score } : {}),
        ...(current.chunk.rerankScore === undefined && chunk.rerankScore !== undefined ? { rerankScore: chunk.rerankScore } : {}),
      };
    });
  }
  return [...fused.values()]
    .sort((a, b) => b.score - a.score || a.firstSeen - b.firstSeen)
    .map(({ chunk }) => chunk);
}
