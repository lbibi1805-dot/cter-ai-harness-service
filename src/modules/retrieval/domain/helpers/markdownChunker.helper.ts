import { CHUNK_OVERLAP_TOKENS } from '../constants/retrieval.constants';
import { estimateTokens } from '../markdownChunker';

/** The last paragraphs whose combined size stays within CHUNK_OVERLAP_TOKENS. */
export function trailingOverlap(paragraphs: string[]): string[] {
  const overlap: string[] = [];
  let tokens = 0;
  for (let i = paragraphs.length - 1; i >= 0; i--) {
    const paragraphTokens = estimateTokens(paragraphs[i]);
    if (tokens + paragraphTokens > CHUNK_OVERLAP_TOKENS) break;
    overlap.unshift(paragraphs[i]);
    tokens += paragraphTokens;
  }
  return overlap;
}
