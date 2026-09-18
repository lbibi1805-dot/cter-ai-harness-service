import { describe, it, expect } from 'vitest';
import { computeBackoffMs, classifyEmbedBatchError } from './retry';

/**
 * Characterization tests for core/retry.ts — locks in the exact backoff math and
 * error classification currently embedded in `KnowledgeIndexer`'s embed-batch retry
 * loop, per PLAN_MODULE_ARCHITECTURE.md mục 6 Phase 0 step 4.
 */
describe('core/retry computeBackoffMs', () => {
  it.each([
    [3000, 0, 30000, 3000],
    [3000, 1, 30000, 6000],
    [3000, 2, 30000, 12000],
    [3000, 3, 30000, 24000],
    [3000, 4, 30000, 30000], // capped: 48000 -> 30000
    [2000, 0, 15000, 2000],
    [2000, 3, 15000, 15000], // capped: 16000 -> 15000
  ])('baseMs=%i attempt=%i capMs=%i -> %i', (baseMs, attempt, capMs, expected) => {
    expect(computeBackoffMs(baseMs, attempt, capMs)).toBe(expected);
  });
});

describe('core/retry classifyEmbedBatchError', () => {
  it('classifies 429 as retryable with the rate-limit backoff (3000ms base, 30000ms cap)', () => {
    expect(classifyEmbedBatchError('Error: 429 Too Many Requests')).toEqual({ retry: true, baseMs: 3000, capMs: 30000 });
  });

  it('classifies "fetch failed" as retryable with the fetch backoff (2000ms base, 15000ms cap)', () => {
    expect(classifyEmbedBatchError('TypeError: fetch failed')).toEqual({ retry: true, baseMs: 2000, capMs: 15000 });
  });

  it('classifies a generic "fetch" substring as retryable with the fetch backoff', () => {
    expect(classifyEmbedBatchError('network fetch error')).toEqual({ retry: true, baseMs: 2000, capMs: 15000 });
  });

  it('classifies any other error as non-retryable', () => {
    expect(classifyEmbedBatchError('Invalid API key')).toEqual({ retry: false, baseMs: 0, capMs: 0 });
  });
});
