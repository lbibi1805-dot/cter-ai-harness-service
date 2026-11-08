import { describe, expect, it } from 'vitest';
import { LatencyRecorder, ModelRoute, type LatencyEntry } from '../../../../../src/modules/ai';

function entry(overrides: Partial<LatencyEntry>): LatencyEntry {
  return { at: 1_000, provider: 'gemini', model: 'g-1', route: ModelRoute.DIRECT, kind: 'stream', totalMs: 100, attempts: 1, ...overrides };
}

describe('LatencyRecorder', () => {
  it('summarizes p50/p95, retries, errors and cache hit rate per provider/model', () => {
    const recorder = new LatencyRecorder(1000, () => 1_000);
    for (let i = 1; i <= 20; i++) {
      recorder.record(entry({ ttftMs: i * 10, totalMs: i * 100, inputTokens: 1000, cachedTokens: 250, outputTokens: 10 }));
    }
    recorder.record(entry({ totalMs: 5_000, attempts: 3, errorKind: 'deadline' }));
    recorder.record(entry({ model: 'g-2', totalMs: 50 }));

    const summary = recorder.summary(60_000);
    expect(summary.count).toBe(22);
    const g1 = summary.groups[0];
    expect(g1).toMatchObject({ provider: 'gemini', model: 'g-1', count: 21, retries: 2, errors: 1, errorsByKind: { deadline: 1 } });
    expect(g1.ttftMs).toEqual({ p50: 100, p95: 190 });
    expect(g1.totalMs).toEqual({ p50: 1_100, p95: 2_000 });
    expect(g1.cacheHitRate).toBeCloseTo(0.25);
    expect(summary.groups[1]).toMatchObject({ model: 'g-2', count: 1, ttftMs: null, cacheHitRate: null });
  });

  it('keeps only the last `capacity` entries and honours the time window', () => {
    let now = 0;
    const recorder = new LatencyRecorder(3, () => now);
    for (let i = 1; i <= 5; i++) recorder.record(entry({ at: i * 1_000, totalMs: i }));
    now = 5_000;
    expect(recorder.entries(10_000).map((e) => e.totalMs)).toEqual([3, 4, 5]);
    expect(recorder.entries(1_500).map((e) => e.totalMs)).toEqual([4, 5]);
  });
});
