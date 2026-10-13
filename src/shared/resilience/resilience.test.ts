import { describe, it, expect, vi } from 'vitest';
import { FailureKind } from './resilience.enums';
import { classifyFailure, extractHttpStatus } from './failureClassifier';
import { backoffDelayMs, retryTransient } from './retry';

function httpError(status: number, message = `HTTP ${status}`) {
  return Object.assign(new Error(message), { status });
}

describe('classifyFailure', () => {
  it.each([
    [httpError(429), FailureKind.RATE_LIMITED],
    [new Error('[GoogleGenerativeAI Error]: [429 Too Many Requests] quota exceeded'), FailureKind.RATE_LIMITED],
    [new Error('Canvas listFilesInFolder failed: 403 Forbidden (Rate Limit Exceeded)'), FailureKind.RATE_LIMITED],
    [httpError(401), FailureKind.FATAL],
    [new Error('GEMINI_API_KEY not configured'), FailureKind.FATAL],
    [new Error('[400 Bad Request] API key not valid. Please pass a valid API key.'), FailureKind.FATAL],
    [httpError(500), FailureKind.TRANSIENT],
    [httpError(503, 'overloaded'), FailureKind.TRANSIENT],
    [new Error('AI timeout after 120000ms (gemini/x)'), FailureKind.TRANSIENT],
    [new Error('fetch failed'), FailureKind.TRANSIENT],
    [new Error('Protocol error: Connection closed.'), FailureKind.TRANSIENT],
    [new Error('Canvas download failed: 400 Bad Request'), FailureKind.PERMANENT],
    [httpError(404, 'model not found'), FailureKind.PERMANENT],
    [httpError(403, 'model access denied'), FailureKind.PERMANENT],
    [new Error('boom'), FailureKind.TRANSIENT],
  ])('%s → %s', (err, kind) => {
    expect(classifyFailure(err)).toBe(kind);
  });

  it('prefers the status property over numbers in the message', () => {
    expect(extractHttpStatus(Object.assign(new Error('gpt-4o 500 tokens'), { status: 400 }))).toBe(400);
  });
});

describe('backoffDelayMs', () => {
  it('grows exponentially and is capped', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((i) => backoffDelayMs(i))).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000]);
  });
});

describe('retryTransient', () => {
  it('retries transient failures with backoff, then succeeds', async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const op = vi.fn()
      .mockRejectedValueOnce(httpError(503))
      .mockRejectedValueOnce(new Error('fetch failed'))
      .mockResolvedValue('ok');
    await expect(retryTransient(op, { maxAttempts: 3, sleep })).resolves.toBe('ok');
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([1000, 2000]);
  });

  it('does not retry permanent failures', async () => {
    const op = vi.fn().mockRejectedValue(new Error('Canvas download failed: 400 Bad Request'));
    await expect(retryTransient(op, { maxAttempts: 5, sleep: vi.fn() })).rejects.toThrow('400');
    expect(op).toHaveBeenCalledTimes(1);
  });

  it('gives up after maxAttempts and rethrows the last error', async () => {
    const op = vi.fn().mockRejectedValue(httpError(500, 'still down'));
    await expect(retryTransient(op, { maxAttempts: 3, sleep: vi.fn().mockResolvedValue(undefined) })).rejects.toThrow('still down');
    expect(op).toHaveBeenCalledTimes(3);
  });
});
