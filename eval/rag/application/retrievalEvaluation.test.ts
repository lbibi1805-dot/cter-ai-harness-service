import { describe, it, expect } from 'vitest';
import type { GoldenItem, RankedChunk } from '../domain';
import { evaluateRetrieval, type QueryRetriever } from './retrievalEvaluation';

const item = (id: string, expected: string[], answerable = true): GoldenItem => ({
  id, question: `question ${id}`, expectedSources: expected, keyPoints: [], answerable,
});
const chunk = (source: string, score: number): RankedChunk => ({ source, heading: '', score });

/** Scripted retriever: answers by question text; throws for unknown ones. */
function fakeRetriever(byQuestion: Record<string, RankedChunk[]>): QueryRetriever {
  return {
    async retrieve(question) {
      const result = byQuestion[question];
      if (!result) throw new Error('pinecone timeout');
      return result;
    },
  };
}

describe('evaluateRetrieval', () => {
  const golden = [
    item('hit-first', ['a.md']),
    item('hit-third', ['b.md']),
    item('miss', ['c.md']),
    item('off-topic', [], false),
    item('broken', ['a.md']),
  ];
  const retriever = fakeRetriever({
    'question hit-first': [chunk('a.md', 0.9), chunk('x.md', 0.5), chunk('y.md', 0.4)],
    'question hit-third': [chunk('x.md', 0.7), chunk('y.md', 0.6), chunk('b.md', 0.55)],
    'question miss': [chunk('x.md', 0.4), chunk('y.md', 0.3), chunk('z.md', 0.2)],
    'question off-topic': [chunk('x.md', 0.21)],
  });

  it('aggregates metrics over answerable, non-errored questions only', async () => {
    const report = await evaluateRetrieval(golden, retriever, [1, 3], 'test');
    expect(report.answerableCount).toBe(3);
    expect(report.erroredCount).toBe(1);
    expect(report.metrics).toEqual([
      { k: 1, hit: 1 / 3, recall: 1 / 3, precision: 1 / 3 },
      { k: 3, hit: 2 / 3, recall: 2 / 3, precision: 2 / 9 },
    ]);
    expect(report.mrr).toBeCloseTo((1 + 1 / 3 + 0) / 3);
  });

  it('records ranks, misses and errors per question', async () => {
    const report = await evaluateRetrieval(golden, retriever, [1, 3], 'test');
    const byId = Object.fromEntries(report.results.map((r) => [r.id, r]));
    expect(byId['hit-first'].firstRelevantRank).toBe(1);
    expect(byId['hit-third'].firstRelevantRank).toBe(3);
    expect(byId.miss.firstRelevantRank).toBeNull();
    expect(byId.broken.error).toBe('pinecone timeout');
    expect(report.misses).toEqual(['miss']);
  });

  it('splits top-1 scores into relevant / irrelevant / unanswerable', async () => {
    const report = await evaluateRetrieval(golden, retriever, [1], 'test');
    expect(report.scores.relevantTop1).toMatchObject({ count: 1, max: 0.9 });
    expect(report.scores.irrelevantTop1).toMatchObject({ count: 2, min: 0.4, max: 0.7 });
    expect(report.scores.unanswerableTop1).toMatchObject({ count: 1, max: 0.21 });
  });
});
