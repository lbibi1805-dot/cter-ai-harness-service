import { CONTEXT_LENGTH_PATTERN } from '../constants/retrieval.constants';

/** The embedding model rejected the input as too long. */
export function isContextLengthError(err: unknown): boolean {
  return err instanceof Error && CONTEXT_LENGTH_PATTERN.test(err.message);
}
