import { describe, expect, it, vi } from 'vitest';
import type { Reranker } from '../../../src/modules/rerank';
import type { CitedChunk } from '../../../src/types';
import type { GoldenItem } from '../domain';
import { compareReports, createRerankVariants, formatComparison } from './rerankComparison';
import { evaluateRetrieval } from './retrievalEvaluation';

const chunk = (source: string, score: number): CitedChunk => ({ chunkId: source, text: `about ${source}`, source, heading: '', parentHeading: '', tokenCount: 5, score });
const CANDIDATES = [chunk('exam.md', 0.6), chunk('notes.md', 0.5), chunk('theory.md', 0.4)];
const LIMITS = { maxQueryChars: 100, maxDocumentChars: 100 };
const items: GoldenItem[] = [
  { id: 'q1', question: 'theory?', expectedSources: ['theory.md'], keyPoints: [], answerable: true },
  { id: 'q2', question: 'notes?', expectedSources: ['notes.md'], keyPoints: [], answerable: true },
];

describe('createRerankVariants', () => {
  it('searches once per question and reranks the same candidates', async () => {
    const source = vi.fn(async () => CANDIDATES);
    const reranker: Reranker = { model: 'fake', rerank: vi.fn(async () => [{ index: 2, score: 0.9 }, { index: 1, score: 0.8 }, { index: 0, score: 0.1 }]) };
    const variants = createRerankVariants(source, reranker, LIMITS);

    expect((await variants.vector.retrieve('theory?')).map((c) => c.source)).toEqual(['exam.md', 'notes.md', 'theory.md']);
    const reranked = await variants.reranked.retrieve('theory?');
    expect(reranked.map((c) => [c.source, c.score])).toEqual([['theory.md', 0.9], ['notes.md', 0.8], ['exam.md', 0.1]]);
    expect(source).toHaveBeenCalledTimes(1);
    expect(variants.timing.calls).toBe(1);
  });

  it('surfaces reranker errors instead of falling back', async () => {
    const reranker: Reranker = { model: 'fake', rerank: async () => { throw new Error('403 plan does not include rerank'); } };
    const variants = createRerankVariants(async () => CANDIDATES, reranker, LIMITS);
    await expect(variants.reranked.retrieve('q')).rejects.toThrow('403');
  });
});

describe('compareReports / formatComparison', () => {
  it('reports metric deltas and per-question rank changes', async () => {
    const reranker: Reranker = { model: 'fake', rerank: async () => [{ index: 2, score: 0.9 }, { index: 0, score: 0.5 }, { index: 1, score: 0.1 }] };
    const variants = createRerankVariants(async () => CANDIDATES, reranker, LIMITS);
    const before = await evaluateRetrieval(items, variants.vector, [1, 3], 'v');
    const after = await evaluateRetrieval(items, variants.reranked, [1, 3], 'r');
    const comparison = compareReports(before, after);

    expect(comparison.improved).toEqual([{ id: 'q1', before: 3, after: 1 }]);
    expect(comparison.worsened).toEqual([{ id: 'q2', before: 2, after: 3 }]);
    expect(comparison.metrics[0]).toMatchObject({ k: 1, hitBefore: 0, hitAfter: 0.5 });
    const text = formatComparison(comparison, 'fake', 3, variants.timing);
    expect(text).toContain('| 1 | 0.0% | 50.0% | +50.0 |');
    expect(text).toContain('| q1 | 3 | 1 |');
  });
});
