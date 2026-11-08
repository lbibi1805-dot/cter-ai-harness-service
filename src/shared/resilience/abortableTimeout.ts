import { TimeoutError } from '../errors';
import { GuardedCallControls, GuardedCallOptions } from './interfaces/abortableTimeout.interface';
import { ABORTED_MESSAGE } from './constants/abortableTimeout.constants';

/**
 * Runs `operation` with real cancellation: when a limit is hit (total, first token, idle between chunks) or the
 * parent signal aborts, the operation's AbortSignal fires (so the SDK drops the HTTP request and stops streaming)
 * and the returned promise rejects at once with a TimeoutError (or the parent's reason). Timers are cleared as soon
 * as the call settles.
 */
export function guardedCall<T>(operation: (controls: GuardedCallControls) => Promise<T>, options: GuardedCallOptions): Promise<T> {
  const controller = new AbortController();
  const { parent, label } = options;
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    let totalTimer: ReturnType<typeof setTimeout> | undefined;
    let stallTimer: ReturnType<typeof setTimeout> | undefined;

    const finish = (settle: () => void): void => {
      if (settled) return;
      settled = true;
      clearTimeout(totalTimer);
      clearTimeout(stallTimer);
      parent?.removeEventListener('abort', onParentAbort);
      settle();
    };
    const fail = (error: Error): void => finish(() => {
      controller.abort(error);
      reject(error);
    });
    function onParentAbort(): void {
      const reason: unknown = parent?.reason;
      fail(reason instanceof Error ? reason : new TimeoutError(`${ABORTED_MESSAGE} (${label})`));
    }
    const armStall = (ms: number | undefined, what: string): void => {
      clearTimeout(stallTimer);
      if (ms === undefined) return;
      stallTimer = setTimeout(() => fail(new TimeoutError(`No ${what} within ${ms}ms (${label})`)), Math.max(0, ms));
    };

    if (parent?.aborted) return onParentAbort();
    if (options.totalMs <= 0) return fail(new TimeoutError(`Timeout after ${options.totalMs}ms (${label})`));
    parent?.addEventListener('abort', onParentAbort, { once: true });
    totalTimer = setTimeout(() => fail(new TimeoutError(`Timeout after ${options.totalMs}ms (${label})`)), options.totalMs);
    armStall(options.firstTokenMs, 'first token');

    const touch = (): void => {
      if (!settled) armStall(options.idleMs, 'new chunk');
    };
    Promise.resolve()
      .then(() => operation({ signal: controller.signal, touch }))
      .then((value) => finish(() => resolve(value)), (error: unknown) => finish(() => reject(error)));
  });
}

/** `withTimeout` that also cancels: the operation gets an AbortSignal that fires when `ms` runs out. */
export function withAbortTimeout<T>(operation: (signal: AbortSignal) => Promise<T>, ms: number, label: string, parent?: AbortSignal): Promise<T> {
  return guardedCall(({ signal }) => operation(signal), { totalMs: ms, label, parent });
}
