/** A retrieved chunk reduced to what the metrics need, in rank order. */
export interface RankedChunk {
  source: string;
  heading: string;
  score: number;
}

/** Relevance is judged per file: a chunk is relevant if its file is expected. */
export function isRelevant(chunk: RankedChunk, expectedSources: readonly string[]): boolean {
  return expectedSources.includes(chunk.source);
}

/** 1 if at least one relevant chunk is in the top k, else 0. */
export function hitAtK(ranked: RankedChunk[], expected: readonly string[], k: number): number {
  return ranked.slice(0, k).some((c) => isRelevant(c, expected)) ? 1 : 0;
}

/** Share of the top-k chunks that are relevant (noise sent to the LLM = 1 − this). */
export function precisionAtK(ranked: RankedChunk[], expected: readonly string[], k: number): number {
  if (k <= 0) return 0;
  return ranked.slice(0, k).filter((c) => isRelevant(c, expected)).length / k;
}

/** Share of the expected files that appear at least once in the top k. */
export function recallAtK(ranked: RankedChunk[], expected: readonly string[], k: number): number {
  if (expected.length === 0) return 0;
  const found = new Set(ranked.slice(0, k).filter((c) => isRelevant(c, expected)).map((c) => c.source));
  return found.size / expected.length;
}

/** 1 / rank of the first relevant chunk (0 when none was retrieved). */
export function reciprocalRank(ranked: RankedChunk[], expected: readonly string[]): number {
  const index = ranked.findIndex((c) => isRelevant(c, expected));
  return index === -1 ? 0 : 1 / (index + 1);
}

export function mean(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, v) => sum + v, 0) / values.length;
}

export interface ScoreStats {
  count: number;
  min: number;
  median: number;
  max: number;
}

export function scoreStats(scores: number[]): ScoreStats | null {
  if (scores.length === 0) return null;
  const sorted = [...scores].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return { count: sorted.length, min: sorted[0], median, max: sorted[sorted.length - 1] };
}
