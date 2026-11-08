import { CONTEXT_LENGTH_PATTERN, MIN_KEPT_CHUNKS } from '../constants/retrieval.constants';
import type { CitedChunk } from '../interfaces/retrieval.interface';

/** The embedding model rejected the input as too long. */
export function isContextLengthError(err: unknown): boolean {
  return err instanceof Error && CONTEXT_LENGTH_PATTERN.test(err.message);
}

/**
 * Drops chunks whose vector score is below `minScore`, keeping the best MIN_KEPT_CHUNKS whatever their score.
 * Chunks without a score are kept. The input is in score order (Pinecone), so the kept prefix is the best.
 */
export function dropLowScores(chunks: CitedChunk[], minScore: number): CitedChunk[] {
  if (minScore <= 0) return chunks;
  return chunks.filter((chunk, index) => index < MIN_KEPT_CHUNKS || chunk.score === undefined || chunk.score >= minScore);
}
