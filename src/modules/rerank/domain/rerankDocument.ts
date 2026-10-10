import type { CitedChunk } from '../../../types';
import { BREADCRUMB_SEPARATOR, MAX_PASSAGES_PER_CHUNK, MAX_RERANK_DOCUMENTS, PASSAGE_OVERLAP_RATIO } from './rerank.enums';

const MARKDOWN_EXTENSION = /\.md$/i;
const HEADING_MARKS = /^#+\s*/;

/** "course › chapter › file › heading" — most indexed chunks do not repeat their heading. */
export function breadcrumbOf(chunk: CitedChunk): string {
  const parts = [
    ...chunk.source.replace(MARKDOWN_EXTENSION, '').split('/'),
    chunk.parentHeading.replace(HEADING_MARKS, ''),
    chunk.heading.replace(HEADING_MARKS, ''),
  ].map((part) => part.trim()).filter(Boolean);
  return parts.filter((part, i) => parts.indexOf(part) === i).join(BREADCRUMB_SEPARATOR);
}

/** The text a reranker scores for a chunk: breadcrumb, then the chunk, cut to `maxChars`. */
export function buildRerankDocument(chunk: CitedChunk, maxChars: number): string {
  return truncate(`${breadcrumbOf(chunk)}\n${chunk.text.trim()}`, maxChars);
}

/**
 * Splits a long chunk into overlapping windows, each prefixed with the
 * breadcrumb, so text beyond the model's window still gets scored. Some
 * chunks run to thousands of tokens; scoring only their first window buries
 * them when the answer sits further down.
 */
export function buildRerankPassages(chunk: CitedChunk, maxChars: number, maxPassages: number): string[] {
  const header = `${breadcrumbOf(chunk)}\n`;
  const body = chunk.text.trim();
  const room = Math.max(1, maxChars - header.length);
  if (body.length <= room || maxPassages <= 1) return [truncate(header + body, maxChars)];

  const stride = Math.max(1, Math.floor(room * (1 - PASSAGE_OVERLAP_RATIO)));
  const passages: string[] = [];
  for (let start = 0; start < body.length && passages.length < maxPassages; start += stride) {
    passages.push(header + body.slice(start, start + room));
    if (start + room >= body.length) break;
  }
  return passages;
}

/** Windows per chunk so one request stays within the reranker's document limit. */
export function passagesPerChunk(candidateCount: number): number {
  if (candidateCount <= 0) return 1;
  return Math.max(1, Math.min(MAX_PASSAGES_PER_CHUNK, Math.floor(MAX_RERANK_DOCUMENTS / candidateCount)));
}

export function truncate(text: string, maxChars: number): string {
  return text.length <= maxChars ? text : text.slice(0, maxChars);
}
