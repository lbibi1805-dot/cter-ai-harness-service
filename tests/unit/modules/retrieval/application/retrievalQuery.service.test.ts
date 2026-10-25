import { describe, it, expect, vi } from 'vitest';
import { ServiceDisabledError } from '../../../../../src/shared/errors';
import { RetrievalQueryService, type RetrievalQueryDeps } from '../../../../../src/modules/retrieval';
import type { CitedChunk } from '../../../../../src/modules/retrieval';

const chunk = (id: string): CitedChunk => ({ chunkId: id, text: id, source: `${id}.md`, heading: '', parentHeading: '', tokenCount: 1 });
const DEFAULT_TOP_K = 6;
const RERANK_CANDIDATES = 40;

function deps(overrides: Partial<RetrievalQueryDeps> = {}) {
  const createRetriever = vi.fn((topK: number) => ({ retrieve: async () => [chunk(`vector-${topK}`)] }));
  const wrap = vi.fn((_inner, options: { topN: number }) => ({ retrieve: async () => [chunk(`reranked-${options.topN}`)] }));
  const base: RetrievalQueryDeps = {
    enabled: true,
    vectorSearch: { defaultTopK: DEFAULT_TOP_K, createRetriever },
    reranker: { enabled: true, candidateCount: () => RERANK_CANDIDATES, wrap },
    productionRetriever: () => ({ retrieve: async () => [chunk('production')] }),
    ...overrides,
  };
  return { base, createRetriever, wrap };
}

describe('RetrievalQueryService', () => {
  it('uses the production retriever when no variant is requested', async () => {
    const { base } = deps();
    await expect(new RetrievalQueryService(base).search({ query: 'q' })).resolves.toEqual([chunk('production')]);
  });

  it('builds a reranked variant with the requested topK', async () => {
    const { base, createRetriever } = deps();
    await expect(new RetrievalQueryService(base).search({ query: 'q', topK: 3 })).resolves.toEqual([chunk('reranked-3')]);
    expect(createRetriever).toHaveBeenCalledWith(RERANK_CANDIDATES);
  });

  it('skips the reranker when rerank=false', async () => {
    const { base, wrap } = deps();
    await expect(new RetrievalQueryService(base).search({ query: 'q', rerank: false })).resolves.toEqual([chunk(`vector-${DEFAULT_TOP_K}`)]);
    expect(wrap).not.toHaveBeenCalled();
  });

  it('fails closed without a token and without a vector index', async () => {
    await expect(new RetrievalQueryService(deps({ enabled: false }).base).search({ query: 'q' })).rejects.toBeInstanceOf(ServiceDisabledError);
    await expect(new RetrievalQueryService(deps({ vectorSearch: null }).base).search({ query: 'q' })).rejects.toBeInstanceOf(ServiceDisabledError);
  });
});
