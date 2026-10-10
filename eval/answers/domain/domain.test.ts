import { describe, it, expect } from 'vitest';
import { AnswerMode } from '../../../src/modules/agent/domain';
import type { GoldenItem } from '../../rag/domain';
import { AnswerMetric, DriftStatus } from './answerEval.enums';
import type { EnvironmentSnapshot, JudgeVerdict, ModeSummary } from './answerEval.types';
import {
  citationScores,
  cosineSimilarity,
  f1Score,
  jaccard,
  latencyStats,
  looksLikeRefusal,
  parseCitedSources,
  percentile,
  scoreSample,
  sourceMatches,
} from './answerMetrics';
import { classifyDrift, compareEnvironment, compareSummaries } from './drift';

const item = (overrides: Partial<GoldenItem> = {}): GoldenItem => ({
  id: 'q', question: 'Q?', expectedSources: ['mon-qnx-current/lab-4/Barriers.md'], keyPoints: ['a', 'b', 'c', 'd'], answerable: true, ...overrides,
});
const verdict = (overrides: Partial<JudgeVerdict> = {}): JudgeVerdict => ({
  claims: [{ text: 'x', supported: true }, { text: 'y', supported: true }, { text: 'z', supported: false }, { text: 'w', supported: true }],
  keyPointsCovered: [true, true, false, false], relevance: 4, refused: false, notes: '', ...overrides,
});

describe('latency', () => {
  it('nearest-rank percentiles', () => {
    const values = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
    expect(percentile(values, 50)).toBe(500);
    expect(percentile(values, 95)).toBe(1000);
    expect(percentile([42], 95)).toBe(42);
    expect(percentile([], 50)).toBe(0);
  });

  it('summary stats', () => {
    expect(latencyStats([300, 100, 200])).toEqual({ mean: 200, p50: 200, p95: 300, max: 300 });
    expect(latencyStats([])).toBeNull();
  });
});

describe('citations', () => {
  it('reads paths from the References section only', () => {
    const answer = [
      'Body mentions lab-6/IPC.md which is not a citation.',
      '## References',
      '- mon-qnx-current/lab-4/Barriers.md',
      '* `mon-qnx-current/lab-4/Mutex-vs-Semaphore.md`',
      '1. Barriers.md',
      '## Appendix',
      '- other.md',
    ].join('\n');
    expect(parseCitedSources(answer)).toEqual([
      'mon-qnx-current/lab-4/barriers.md',
      'mon-qnx-current/lab-4/mutex-vs-semaphore.md',
      'barriers.md',
    ]);
    expect(parseCitedSources('**References:**\n- a/b.md')).toEqual(['a/b.md']);
    expect(parseCitedSources('no references here')).toEqual([]);
  });

  it('keeps file names that contain spaces, commas-separated lists and link targets', () => {
    const answer = [
      '## References',
      '- Chapter 1 - Testing Fundamentals.md',
      '- `software-tesing-ISYS2092-SYS3397/Chapter 4 - Testing Techniques/03 - White-Box.md`',
      '- A.md, B c.md',
      '- [Black-box notes](Chapter 4/02 - Black-Box.md)',
    ].join('\n');
    expect(parseCitedSources(answer)).toEqual([
      'chapter 1 - testing fundamentals.md',
      'software-tesing-isys2092-sys3397/chapter 4 - testing techniques/03 - white-box.md',
      'a.md',
      'b c.md',
      'chapter 4/02 - black-box.md',
    ]);
    expect(sourceMatches('Chapter 1 - Testing Fundamentals.md',
      'software-tesing-ISYS2092-SYS3397/Chapter 1 - Testing Fundamentals/Chapter 1 - Testing Fundamentals.md')).toBe(true);
  });

  it('matches full paths, suffixes and bare file names case-insensitively', () => {
    expect(sourceMatches('Barriers.md', 'mon-qnx-current/lab-4/Barriers.md')).toBe(true);
    expect(sourceMatches('lab-4/barriers.md', 'mon-qnx-current/lab-4/Barriers.md')).toBe(true);
    expect(sourceMatches('ers.md', 'mon-qnx-current/lab-4/Barriers.md')).toBe(false);
  });

  it('precision and recall against expected sources', () => {
    expect(citationScores(['barriers.md', 'other.md'], ['lab-4/Barriers.md', 'lab-4/Mutex.md'])).toEqual({ precision: 0.5, recall: 0.5 });
    expect(citationScores([], ['a.md'])).toEqual({ precision: null, recall: 0 });
    expect(citationScores(['a.md'], [])).toEqual({ precision: null, recall: null });
  });
});

describe('scoreSample', () => {
  it('computes precision from supported claims and completeness from key points', () => {
    const scores = scoreSample(item(), verdict(), ['Barriers.md']);
    expect(scores.answerPrecision).toBe(0.75);
    expect(scores.completeness).toBe(0.5);
    expect(scores.f1).toBeCloseTo(f1Score(0.75, 0.5)!);
    expect(scores.relevance).toBe(0.8);
    expect(scores).toMatchObject({ citationPrecision: 1, citationRecall: 1, refusalCorrect: true });
  });

  it('expects a refusal for unanswerable questions', () => {
    const unanswerable = item({ answerable: false, expectedSources: [], keyPoints: [] });
    expect(scoreSample(unanswerable, verdict({ refused: true, claims: [] }), []).refusalCorrect).toBe(true);
    expect(scoreSample(unanswerable, verdict({ refused: false }), []).refusalCorrect).toBe(false);
    expect(scoreSample(item(), verdict({ refused: true }), []).refusalCorrect).toBe(false);
  });

  it('keeps citation scores but nulls judged scores without a verdict', () => {
    expect(scoreSample(item(), undefined, ['Barriers.md'])).toMatchObject({ answerPrecision: null, f1: null, citationRecall: 1 });
  });

  it('heuristic refusal detection', () => {
    expect(looksLikeRefusal('The provided documents do not contain information about this topic')).toBe(true);
    expect(looksLikeRefusal('A mutex has an owner.')).toBe(false);
  });
});

describe('similarity', () => {
  it('cosine and jaccard', () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBe(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
    expect(cosineSimilarity([1], [1, 2])).toBe(0);
    expect(jaccard(['a.md', 'b.md'], ['B.md', 'c.md'])).toBeCloseTo(1 / 3);
    expect(jaccard([], [])).toBeNull();
  });
});

describe('drift', () => {
  it('respects metric direction and noise thresholds', () => {
    expect(classifyDrift(AnswerMetric.F1, 0.6, 0.62).status).toBe(DriftStatus.STABLE);
    expect(classifyDrift(AnswerMetric.F1, 0.6, 0.7).status).toBe(DriftStatus.IMPROVED);
    expect(classifyDrift(AnswerMetric.F1, 0.6, 0.5).status).toBe(DriftStatus.REGRESSED);
    expect(classifyDrift(AnswerMetric.ERROR_RATE, 0.0, 0.1).status).toBe(DriftStatus.REGRESSED);
    expect(classifyDrift(AnswerMetric.LATENCY_P95_MS, 10_000, 12_000).status).toBe(DriftStatus.STABLE);
    expect(classifyDrift(AnswerMetric.LATENCY_P95_MS, 10_000, 14_000).status).toBe(DriftStatus.REGRESSED);
    expect(classifyDrift(AnswerMetric.LATENCY_P95_MS, 10_000, 5_000).status).toBe(DriftStatus.IMPROVED);
    expect(classifyDrift(AnswerMetric.F1, null, 0.5).status).toBe(DriftStatus.UNCOMPARABLE);
  });

  it('compares summaries per mode', () => {
    const summary = (mode: AnswerMode, f1: number): ModeSummary => ({ mode, samples: 1, metrics: { [AnswerMetric.F1]: f1 }, latency: null, tokens: null, meanToolCalls: null });
    const drifts = compareSummaries([summary(AnswerMode.SINGLE_SHOT, 0.6)], [summary(AnswerMode.SINGLE_SHOT, 0.4), summary(AnswerMode.AGENT, 0.7)]);
    expect(drifts).toEqual([
      { mode: AnswerMode.SINGLE_SHOT, metric: AnswerMetric.F1, baseline: 0.6, current: 0.4, delta: expect.closeTo(-0.2), status: DriftStatus.REGRESSED },
      { mode: AnswerMode.AGENT, metric: AnswerMetric.F1, baseline: null, current: 0.7, delta: null, status: DriftStatus.UNCOMPARABLE },
    ]);
  });

  it('reports data drift fields that changed', () => {
    const env: EnvironmentSnapshot = { vaultFiles: 235, vaultIndexed: 235, vectorCount: 871, embeddingProvider: 'openai', pineconeIndex: 'idx' };
    expect(compareEnvironment(env, { ...env, vectorCount: 900, vaultFiles: 240 })).toEqual([
      { field: 'vaultFiles', baseline: 235, current: 240 },
      { field: 'vectorCount', baseline: 871, current: 900 },
    ]);
  });
});
