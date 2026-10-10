import { afterEach, describe, expect, it, vi } from 'vitest';
import { withTimeout } from './withTimeout';

describe('withTimeout', () => {
  afterEach(() => vi.useRealTimers());

  it('resolves with the value and clears its timer', async () => {
    vi.useFakeTimers();
    await expect(withTimeout(Promise.resolve('ok'), 60_000, 'x')).resolves.toBe('ok');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rejects with the original error and clears its timer', async () => {
    vi.useFakeTimers();
    await expect(withTimeout(Promise.reject(new Error('boom')), 60_000, 'x')).rejects.toThrow('boom');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rejects with a timeout error naming the label when the promise is too slow', async () => {
    vi.useFakeTimers();
    const pending = withTimeout(new Promise(() => undefined), 1_000, 'openai/gpt-x');
    const assertion = expect(pending).rejects.toThrow('AI timeout after 1000ms (openai/gpt-x)');
    await vi.advanceTimersByTimeAsync(1_000);
    await assertion;
  });
});
