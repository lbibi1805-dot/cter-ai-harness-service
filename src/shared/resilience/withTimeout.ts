import { TimeoutError } from '../errors';

/**
 * Rejects with TimeoutError after `ms` unless `promise` settles first. The
 * timer is cleared as soon as the race is decided, so finished calls do not
 * leave timers behind (under load those would pile up for the full timeout).
 * Pass the `controller` whose signal the call uses to also cancel the call on
 * timeout (see `withAbortTimeout` for the variant that owns the controller).
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, label: string, controller?: AbortController): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const error = new TimeoutError(`Timeout after ${ms}ms (${label})`);
      controller?.abort(error);
      reject(error);
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
