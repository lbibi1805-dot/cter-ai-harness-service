import { describe, expect, it } from 'vitest';
import { CachedEmbeddingService } from '../../../../../src/modules/retrieval/infrastructure/cachedEmbedding.adapter';
import { dropLowScores } from '../../../../../src/modules/retrieval/domain/helpers/retrieval.helper';
import { DEFAULT_MIN_SCORE, DEFAULT_TOP_K, EmbeddingProvider, type CitedChunk, type EmbeddingService } from '../../../../../src/modules/retrieval';

const chunk = (id: string, score?: number): CitedChunk => ({ chunkId: id, text: id, source: `${id}.md`, heading: '', parentHeading: '', tokenCount: 1, score });

describe('RAG input size (07 §3.4)', () => {
  it('defaults to top 8 and a 0.3 minimum score', () => {
    expect(DEFAULT_TOP_K).toBe(8);
    expect(DEFAULT_MIN_SCORE).toBe(0.3);
  });

  it('drops low-score chunks but always keeps the best two', () => {
    const chunks = [chunk('a', 0.8), chunk('b', 0.5), chunk('c', 0.2), chunk('d'), chunk('e', 0.1)];
    expect(dropLowScores(chunks, 0.3).map((c) => c.chunkId)).toEqual(['a', 'b', 'd']);
    expect(dropLowScores([chunk('x', 0.1), chunk('y', 0.05), chunk('z', 0.01)], 0.3).map((c) => c.chunkId)).toEqual(['x', 'y']);
    expect(dropLowScores(chunks, 0)).toHaveLength(5);
  });
});

describe('CachedEmbeddingService', () => {
  it('serves repeated questions from an LRU cache and leaves batches alone', async () => {
    let calls = 0;
    const inner: EmbeddingService = {
      dimension: 3,
      provider: EmbeddingProvider.GEMINI,
      embed: async (text) => { calls++; return [text.length, 0, 0]; },
      embedBatch: async (texts) => texts.map(() => [0, 0, 0]),
    };
    const cached = new CachedEmbeddingService(inner, 2);
    await cached.embed('a');
    await cached.embed('a');
    expect(calls).toBe(1);
    await cached.embed('bb');
    await cached.embed('a');
    await cached.embed('ccc');
    await cached.embed('a');
    expect(calls).toBe(3);
    await cached.embed('bb');
    expect(calls).toBe(4);
    expect(cached.dimension).toBe(3);
    expect(cached.provider).toBe(EmbeddingProvider.GEMINI);
  });
});
