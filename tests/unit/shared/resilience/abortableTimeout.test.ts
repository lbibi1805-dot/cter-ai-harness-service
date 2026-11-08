import { afterEach, describe, expect, it, vi } from 'vitest';
import { TimeoutError } from '../../../../src/shared/errors';
import { CircuitBreaker, guardedCall, withAbortTimeout, withTimeout } from '../../../../src/shared/resilience';

/** An operation that never settles on its own and records whether its signal fired. */
function hanging() {
  const seen: { signal?: AbortSignal } = {};
  const operation = (signal: AbortSignal) => {
    seen.signal = signal;
    return new Promise<string>(() => undefined);
  };
  return { operation, seen };
}

describe('withAbortTimeout / guardedCall', () => {
  afterEach(() => vi.useRealTimers());

  it('aborts the operation when the time runs out', async () => {
    vi.useFakeTimers();
    const { operation, seen } = hanging();
    const pending = withAbortTimeout(operation, 1_000, 'gemini/x');
    const assertion = expect(pending).rejects.toBeInstanceOf(TimeoutError);
    await vi.advanceTimersByTimeAsync(1_000);
    await assertion;
    expect(seen.signal?.aborted).toBe(true);
    expect(seen.signal?.reason).toBeInstanceOf(TimeoutError);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('clears its timers and does not abort when the operation finishes in time', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    await expect(withAbortTimeout(async (s) => { signal = s; return 'ok'; }, 1_000, 'x')).resolves.toBe('ok');
    expect(signal?.aborted).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('fails a stream that sends no first token in time', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const pending = guardedCall(({ signal: s }) => { signal = s; return new Promise(() => undefined); }, { totalMs: 60_000, firstTokenMs: 100, idleMs: 1_000, label: 'x' });
    const assertion = expect(pending).rejects.toThrow('No first token within 100ms (x)');
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
    expect(signal?.aborted).toBe(true);
  });

  it('switches to the idle limit after the first token and fails a stalled stream', async () => {
    vi.useFakeTimers();
    let touch: () => void = () => undefined;
    const pending = guardedCall((controls) => { touch = controls.touch; return new Promise(() => undefined); }, { totalMs: 60_000, firstTokenMs: 100, idleMs: 300, label: 'x' });
    const assertion = expect(pending).rejects.toThrow('No new chunk within 300ms (x)');
    await vi.advanceTimersByTimeAsync(90);
    touch();
    await vi.advanceTimersByTimeAsync(250);
    touch();
    await vi.advanceTimersByTimeAsync(299);
    touch();
    await vi.advanceTimersByTimeAsync(300);
    await assertion;
  });

  it('aborts with the parent signal (request deadline, client gone)', async () => {
    const parent = new AbortController();
    const { operation, seen } = hanging();
    const pending = withAbortTimeout(operation, 60_000, 'x', parent.signal);
    parent.abort(new Error('client left'));
    await expect(pending).rejects.toThrow('client left');
    expect(seen.signal?.aborted).toBe(true);
  });

  it('fails at once when no time is left', async () => {
    await expect(withAbortTimeout(async () => 'never', 0, 'x')).rejects.toBeInstanceOf(TimeoutError);
  });

  it('withTimeout aborts the controller it was given', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const pending = withTimeout(new Promise(() => undefined), 50, 'x', controller);
    const assertion = expect(pending).rejects.toBeInstanceOf(TimeoutError);
    await vi.advanceTimersByTimeAsync(50);
    await assertion;
    expect(controller.signal.aborted).toBe(true);
  });
});

describe('CircuitBreaker', () => {
  const options = { failureThreshold: 3, windowMs: 60_000, cooldownMs: 120_000 };

  it('opens after N failures within the window and closes after the cooldown', () => {
    let now = 0;
    const breaker = new CircuitBreaker(options, () => now);
    expect(breaker.recordFailure('m', '503')).toBe(false);
    now = 10_000;
    expect(breaker.recordFailure('m', '503')).toBe(false);
    expect(breaker.isOpen('m')).toBe(false);
    now = 20_000;
    expect(breaker.recordFailure('m', 'overloaded')).toBe(true);
    expect(breaker.isOpen('m')).toBe(true);
    expect(breaker.snapshot()).toEqual([{ key: 'm', openUntil: 140_000, reason: 'overloaded' }]);
    now = 139_999;
    expect(breaker.isOpen('m')).toBe(true);
    now = 140_000;
    expect(breaker.isOpen('m')).toBe(false);
    expect(breaker.snapshot()).toEqual([]);
  });

  it('forgets failures older than the window', () => {
    let now = 0;
    const breaker = new CircuitBreaker(options, () => now);
    breaker.recordFailure('m', 'x');
    breaker.recordFailure('m', 'x');
    now = 61_000;
    expect(breaker.recordFailure('m', 'x')).toBe(false);
    expect(breaker.isOpen('m')).toBe(false);
  });

  it('a success clears the failures', () => {
    const breaker = new CircuitBreaker(options, () => 0);
    breaker.recordFailure('m', 'x');
    breaker.recordFailure('m', 'x');
    breaker.recordSuccess('m');
    expect(breaker.recordFailure('m', 'x')).toBe(false);
  });
});
