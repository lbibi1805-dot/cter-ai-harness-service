/**
 * Rejects after `ms` unless `promise` settles first. The timer is cleared as
 * soon as the race is decided, so finished calls do not leave timers behind
 * (under load those would pile up for the full timeout).
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`AI timeout after ${ms}ms (${label})`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
