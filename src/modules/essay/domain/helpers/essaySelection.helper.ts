import type { EssaySelection } from '../interfaces/essay.interface';

interface Identified {
  chunkId: string;
}

/**
 * Context for the essay (15 §3.1): `ranked` is the fused (and reranked) order of every query's hits;
 * `aspectLists[i]` are aspect i's own hits. Round by round, each aspect first gets up to `minPerAspect`
 * chunks of its own list (best-ranked first), then the remaining budget follows `ranked`. Output keeps
 * `ranked` order. Coverage = aspects with at least one of their chunks in the context.
 */
export function selectEssayChunks<T extends Identified>(
  ranked: T[],
  aspectLists: T[][],
  minPerAspect: number,
  budget: number,
): EssaySelection<T> {
  const rankOf = new Map(ranked.map((chunk, index) => [chunk.chunkId, index]));
  const byId = new Map<string, T>(ranked.map((chunk) => [chunk.chunkId, chunk]));
  for (const list of aspectLists) for (const chunk of list) if (!byId.has(chunk.chunkId)) byId.set(chunk.chunkId, chunk);
  const order = (id: string): number => rankOf.get(id) ?? Number.MAX_SAFE_INTEGER;
  const lists = aspectLists.map((list) => [...new Set(list.map((chunk) => chunk.chunkId))].sort((a, b) => order(a) - order(b)));

  const selected = new Set<string>();
  for (let round = 1; round <= minPerAspect; round++) {
    for (const ids of lists) {
      if (selected.size >= budget) break;
      const have = ids.filter((id) => selected.has(id)).length;
      if (have >= round) continue;
      const next = ids.find((id) => !selected.has(id));
      if (next) selected.add(next);
    }
  }
  for (const chunk of ranked) {
    if (selected.size >= budget) break;
    selected.add(chunk.chunkId);
  }

  const chunks = [...selected].sort((a, b) => order(a) - order(b)).map((id) => byId.get(id)!);
  const covered = lists.filter((ids) => ids.some((id) => selected.has(id))).length;
  return { chunks, coverage: lists.length ? covered / lists.length : 1 };
}
