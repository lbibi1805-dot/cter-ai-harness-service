import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CitedChunk } from '../../types';
import {
  applyHits,
  buildRerankDocument,
  buildRerankPassages,
  buildRerankRequest,
  fuseWithVectorOrder,
  passagesPerChunk,
  createRerankModule,
  DEFAULT_RERANK_CONFIG,
  parseRerankProvider,
  RerankingRetriever,
  RerankProvider,
  type ChunkRetriever,
  type Reranker,
  type RerankHit,
} from '.';

const chunk = (i: number, overrides: Partial<CitedChunk> = {}): CitedChunk => ({
  chunkId: `c${i}`, text: `text ${i}`, source: `course/ch${i}.md`, heading: `## H${i}`, parentHeading: '', tokenCount: 10, score: 1 - i / 100, ...overrides,
});
const CANDIDATES = Array.from({ length: 6 }, (_, i) => chunk(i));
const inner = (chunks: CitedChunk[] = CANDIDATES): ChunkRetriever => ({ retrieve: vi.fn(async () => chunks) });
const OPTIONS = { topN: 3, fallbackTopK: 4, timeoutMs: 50, maxQueryChars: 20, maxDocumentChars: 200, label: 'test' };

function fakeReranker(impl: (query: string, documents: string[], topN: number) => Promise<RerankHit[]>): Reranker & { rerank: ReturnType<typeof vi.fn> } {
  return { model: 'fake-reranker', rerank: vi.fn(impl) };
}

describe('buildRerankDocument', () => {
  it('prefixes the chunk with a breadcrumb of path parts and headings, without duplicates or # marks', () => {
    const doc = buildRerankDocument(chunk(1, {
      source: 'software-testing/Chapter 4 - Techniques/02 - Black-Box.md', parentHeading: '# 02 - Black-Box', heading: '## Equivalence Partitioning', text: '  EP divides inputs.  ',
    }), 500);
    expect(doc).toBe('software-testing › Chapter 4 - Techniques › 02 - Black-Box › Equivalence Partitioning\nEP divides inputs.');
  });

  it('cuts the document to the character budget', () => {
    expect(buildRerankDocument(chunk(1, { text: 'x'.repeat(500) }), 50)).toHaveLength(50);
  });
});

describe('passages', () => {
  it('keeps a short chunk as one document', () => {
    expect(buildRerankPassages(chunk(1, { text: 'short' }), 200, 3)).toEqual(['course › ch1 › H1\nshort']);
  });

  it('splits a long chunk into overlapping windows that all carry the breadcrumb', () => {
    const header = 'course › ch1 › H1\n';
    const text = 'abcdefghijklmnopqrstuvwxyz'.repeat(10);
    const passages = buildRerankPassages(chunk(1, { text }), header.length + 50, 3);
    expect(passages).toHaveLength(3);
    const bodies = passages.map((p) => {
      expect(p.startsWith(header)).toBe(true);
      return p.slice(header.length);
    });
    expect(bodies.map((b) => b.length)).toEqual([50, 50, 50]);
    // 20% overlap: each window starts 40 characters after the previous one.
    expect(bodies[1]).toBe(text.slice(40, 90));
    expect(bodies[0].slice(40)).toBe(bodies[1].slice(0, 10));
  });

  it('caps passages per chunk so a request stays under the document limit', () => {
    expect(passagesPerChunk(40)).toBe(2);
    expect(passagesPerChunk(20)).toBe(3);
    expect(passagesPerChunk(150)).toBe(1);
    const { documents, owners } = buildRerankRequest(Array.from({ length: 40 }, (_, i) => chunk(i, { text: 'x'.repeat(5000) })), 1500);
    expect(documents.length).toBeLessThanOrEqual(100);
    expect(owners.filter((o) => o === 7)).toHaveLength(2);
  });
});

describe('applyHits', () => {
  it('orders by score and drops out-of-range, fractional and repeated indexes', () => {
    const ranked = applyHits(CANDIDATES, [
      { index: 2, score: 0.4 }, { index: 5, score: 0.9 }, { index: 9, score: 0.99 }, { index: 1.5, score: 0.95 }, { index: 5, score: 0.1 }, { index: -1, score: 0.8 },
    ]);
    expect(ranked.map((c) => [c.chunkId, c.rerankScore])).toEqual([['c5', 0.9], ['c2', 0.4]]);
    expect(ranked[0].score).toBe(CANDIDATES[5].score);
  });
});

describe('applyHits with passages / fuseWithVectorOrder', () => {
  it('scores a chunk by its best passage', () => {
    const ranked = applyHits(CANDIDATES.slice(0, 2), [{ index: 0, score: 0.2 }, { index: 1, score: 0.9 }, { index: 2, score: 0.5 }], [0, 0, 1]);
    expect(ranked.map((c) => [c.chunkId, c.rerankScore])).toEqual([['c0', 0.9], ['c1', 0.5]]);
  });

  it('fusion pulls a strong vector hit back up when the reranker buried it', () => {
    const reranked = [CANDIDATES[5], CANDIDATES[4], CANDIDATES[3], CANDIDATES[2], CANDIDATES[1], CANDIDATES[0]];
    const fused = fuseWithVectorOrder(reranked, CANDIDATES, 1);
    expect(fused.findIndex((c) => c.chunkId === 'c0')).toBeLessThan(5);
    expect(fuseWithVectorOrder(CANDIDATES, CANDIDATES).map((c) => c.chunkId)).toEqual(CANDIDATES.map((c) => c.chunkId));
  });
});

describe('RerankingRetriever', () => {
  it('reranks the candidates and keeps the best topN, with the query and documents cut to budget', async () => {
    const reranker = fakeReranker(async () => [{ index: 4, score: 0.95 }, { index: 0, score: 0.7 }, { index: 3, score: 0.6 }]);
    const result = await new RerankingRetriever(inner(), reranker, OPTIONS).retrieve('  what is equivalence partitioning in black-box testing?  ');

    expect(result.map((c) => c.chunkId)).toEqual(['c4', 'c0', 'c3']);
    const [query, documents, topN] = reranker.rerank.mock.calls[0];
    expect(query).toBe('what is equivalence ');
    expect(documents).toHaveLength(6);
    expect(documents[0]).toBe('course › ch0 › H0\ntext 0');
    expect(topN).toBe(6); // every passage is scored; the decorator keeps the best 3 chunks
  });

  it('falls back to the vector order cut to fallbackTopK when the reranker throws', async () => {
    const reranker = fakeReranker(async () => { throw new Error('429 quota exceeded'); });
    const result = await new RerankingRetriever(inner(), reranker, OPTIONS).retrieve('q');
    expect(result.map((c) => c.chunkId)).toEqual(['c0', 'c1', 'c2', 'c3']);
  });

  it('falls back when the reranker is slower than the timeout', async () => {
    const reranker = fakeReranker(() => new Promise(() => undefined));
    const result = await new RerankingRetriever(inner(), reranker, { ...OPTIONS, timeoutMs: 10 }).retrieve('q');
    expect(result).toHaveLength(4);
  });

  it('falls back when the reranker returns nothing usable', async () => {
    const reranker = fakeReranker(async () => [{ index: 42, score: 1 }]);
    const result = await new RerankingRetriever(inner(), reranker, OPTIONS).retrieve('q');
    expect(result.map((c) => c.chunkId)).toEqual(['c0', 'c1', 'c2', 'c3']);
  });

  it('does not call the reranker for zero or one candidate', async () => {
    const reranker = fakeReranker(async () => []);
    expect(await new RerankingRetriever(inner([]), reranker, OPTIONS).retrieve('q')).toEqual([]);
    expect(await new RerankingRetriever(inner([chunk(0)]), reranker, OPTIONS).retrieve('q')).toHaveLength(1);
    expect(reranker.rerank).not.toHaveBeenCalled();
  });

  it('propagates vector-search failures (the caller already falls back to knowledge.md)', async () => {
    const failing: ChunkRetriever = { retrieve: async () => { throw new Error('pinecone down'); } };
    await expect(new RerankingRetriever(failing, fakeReranker(async () => []), OPTIONS).retrieve('q')).rejects.toThrow('pinecone down');
  });
});

describe('createRerankModule', () => {
  it('is a no-op when the provider is none or there is no Pinecone key', () => {
    for (const ranking of [
      createRerankModule(DEFAULT_RERANK_CONFIG, { pineconeApiKey: 'k' }),
      createRerankModule({ ...DEFAULT_RERANK_CONFIG, provider: RerankProvider.PINECONE }, {}),
    ]) {
      const base = inner();
      expect(ranking.enabled).toBe(false);
      expect(ranking.candidateCount(20)).toBe(20);
      expect(ranking.wrap(base, { topN: 8, fallbackTopK: 20, label: 'x' })).toBe(base);
    }
  });

  it('widens the candidate list and wraps retrieval when enabled', async () => {
    const reranker = fakeReranker(async () => [{ index: 1, score: 0.9 }]);
    const ranking = createRerankModule({ ...DEFAULT_RERANK_CONFIG, provider: RerankProvider.PINECONE, candidates: 40 }, { reranker });
    expect(ranking.enabled).toBe(true);
    expect(ranking.candidateCount(20)).toBe(40);
    expect(ranking.candidateCount(60)).toBe(60);
    const wrapped = ranking.wrap(inner(), { topN: 8, fallbackTopK: 20, label: 'x' });
    expect((await wrapped.retrieve('q')).map((c) => c.chunkId)).toEqual(['c1']);
  });

  it('parses the provider leniently', () => {
    expect(parseRerankProvider('pinecone')).toBe(RerankProvider.PINECONE);
    expect(parseRerankProvider('cohere')).toBe(RerankProvider.NONE);
    expect(parseRerankProvider(undefined)).toBe(RerankProvider.NONE);
  });
});

afterEach(() => vi.restoreAllMocks());
