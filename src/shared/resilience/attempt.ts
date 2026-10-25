import { Attempt } from './interfaces/attempt.interface';

/**
 * Runs an operation that may throw and returns the outcome as a value, so
 * callers branch with `if (!result.ok)` instead of wrapping code in
 * try/catch. This is the one sanctioned catch for application-level
 * fallbacks (e.g. "RAG failed, use knowledge.md").
 */
export async function attempt<T>(operation: () => Promise<T>): Promise<Attempt<T>> {
  try {
    return { ok: true, value: await operation() };
  } catch (error) {
    return { ok: false, error };
  }
}

/** Synchronous variant for parsers that signal bad input by throwing (JSON.parse, URL). */
export function attemptSync<T>(operation: () => T): Attempt<T> {
  try {
    return { ok: true, value: operation() };
  } catch (error) {
    return { ok: false, error };
  }
}
