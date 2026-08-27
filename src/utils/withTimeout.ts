export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`AI timeout after ${ms}ms (${label})`)), ms)
  );
  return Promise.race([promise, timeout]);
}
