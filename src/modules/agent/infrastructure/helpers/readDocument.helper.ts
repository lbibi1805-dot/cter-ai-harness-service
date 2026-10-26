import { estimateTokens } from '../../../retrieval/domain/markdownChunker';
import type { CitedChunk } from '../../../retrieval/domain/interfaces/retrieval.interface';
import { LINE_BREAK, HEADING_LINE } from '../constants/readDocument.constants';

/**
 * Returns the section that starts at the first heading containing `heading`
 * (case-insensitive) and ends before the next heading of the same or a higher
 * level. Null when no heading matches.
 */
export function extractSection(markdown: string, heading: string): string | null {
  const lines = markdown.split(LINE_BREAK);
  const needle = heading.toLowerCase();
  const start = lines.findIndex((line) => {
    const match = line.match(HEADING_LINE);
    return match !== null && match[2].toLowerCase().includes(needle);
  });
  if (start === -1) return null;

  const level = lines[start].match(HEADING_LINE)![1].length;
  const relativeEnd = lines.slice(start + 1).findIndex((line) => {
    const match = line.match(HEADING_LINE);
    return match !== null && match[1].length <= level;
  });
  const end = relativeEnd === -1 ? lines.length : start + 1 + relativeEnd;
  return lines.slice(start, end).join('\n').trim();
}

export function listHeadings(markdown: string): string[] {
  return markdown.split(LINE_BREAK).map((line) => line.match(HEADING_LINE)?.[2]?.trim()).filter((h): h is string => !!h);
}

/** A whole document or section the model read, as an evaluation context. */
export function readContext(filePath: string, heading: string, text: string): CitedChunk {
  return { chunkId: `${filePath}#${heading}`, text, source: filePath, heading, parentHeading: '', tokenCount: estimateTokens(text) };
}
