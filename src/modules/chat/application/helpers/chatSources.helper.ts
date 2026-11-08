import type { AnswerResult } from '../../../agent/domain';
import type { CitedChunk } from '../../../retrieval';
import { MAX_ANSWER_SOURCES, MAX_SOURCE_SCORE, MIN_SOURCE_SCORE } from '../constants/chatSources.constants';
import type { ChatSource } from '../interfaces/chat.interface';

function relevance(chunk: CitedChunk): number | null {
  const raw = chunk.rerankScore ?? chunk.score;
  return raw === undefined || !Number.isFinite(raw) ? null : Math.min(MAX_SOURCE_SCORE, Math.max(MIN_SOURCE_SCORE, raw));
}

function better(candidate: number | null, current: number | null): boolean {
  return candidate !== null && (current === null || candidate > current);
}

/**
 * The files an answer drew on, for the collapsed "📚 N nguồn" list: single-shot = the chunks put in the
 * prompt; agent = the passages and files the tools actually returned. Deduped by file (keeping the
 * best-scoring heading), best first, at most MAX_ANSWER_SOURCES.
 */
export function buildAnswerSources(answer: Pick<AnswerResult, 'contexts' | 'agent'>): ChatSource[] {
  const byFile = new Map<string, ChatSource>();
  for (const chunk of answer.contexts ?? []) {
    if (!chunk.source) continue;
    const score = relevance(chunk);
    const current = byFile.get(chunk.source);
    if (!current || better(score, current.score)) {
      byFile.set(chunk.source, { file: chunk.source, heading: chunk.heading || chunk.parentHeading || '', score });
    }
  }
  // Agent: a file read whole may have produced no scored passage; it was still returned by a tool.
  for (const file of answer.agent?.sourcesRead ?? []) {
    if (file && !byFile.has(file)) byFile.set(file, { file, heading: '', score: null });
  }
  return [...byFile.values()]
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
    .slice(0, MAX_ANSWER_SOURCES);
}
