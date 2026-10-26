import * as path from 'path';
import {
  CHARS_PER_TOKEN,
  CHUNK_ID_HEADING_MAX_CHARS,
  CHUNK_INDEX_DIGITS,
  CHUNK_MAX_TOKENS,
} from './constants/retrieval.constants';
import type { IndexedChunk } from './interfaces/retrieval.interface';
import { MarkdownSection, ChunkCounter } from './interfaces/markdownChunker.interface';
import { PARAGRAPH_JOINER, H2_PREFIX, H1_PREFIX, MARKDOWN_EXTENSION, PARAGRAPH_BREAK } from './constants/markdownChunker.constants';
import { trailingOverlap } from './helpers/markdownChunker.helper';

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Splits a document into `##` sections (each remembering its `#` parent).
 * Text before the first `##` is not a section; a document without any `##`
 * yields no sections.
 */
export function parseMarkdownSections(content: string): MarkdownSection[] {
  const sections: MarkdownSection[] = [];
  let h1 = '';
  let h2 = '';
  let body: string[] = [];

  const flush = (): void => {
    const text = body.join('\n').trim();
    if (h2 && text) sections.push({ heading: h2, parentHeading: h1, content: text });
    body = [];
  };

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trimEnd();
    if (line.startsWith(H2_PREFIX)) {
      flush();
      h2 = line.slice(H2_PREFIX.length).trim();
    } else if (line.startsWith(H1_PREFIX)) {
      flush();
      h1 = line.slice(H1_PREFIX.length).trim();
      h2 = '';
    } else {
      body.push(rawLine);
    }
  }
  flush();
  return sections;
}

/** Chunks a whole (already normalized) document; a heading-less file becomes one titled section. */
export function chunkDocument(source: string, normalizedContent: string, nextIndex: ChunkCounter): IndexedChunk[] {
  const sections = parseMarkdownSections(normalizedContent);
  if (sections.length === 0 && normalizedContent.trim()) {
    return chunkSection(normalizedContent.trim(), source, path.basename(source, MARKDOWN_EXTENSION), '', nextIndex);
  }
  return sections.flatMap((section) => chunkSection(section.content, source, section.heading, section.parentHeading, nextIndex));
}

/**
 * A section that fits CHUNK_MAX_TOKENS stays whole. Larger ones are packed
 * paragraph by paragraph, and each new chunk repeats the previous chunk's
 * trailing paragraphs (up to CHUNK_OVERLAP_TOKENS) for context continuity.
 */
export function chunkSection(
  text: string,
  source: string,
  heading: string,
  parentHeading: string,
  nextIndex: ChunkCounter,
): IndexedChunk[] {
  if (estimateTokens(text) <= CHUNK_MAX_TOKENS) return [makeChunk(text, source, heading, parentHeading, nextIndex())];

  const chunks: IndexedChunk[] = [];
  let current: string[] = [];
  let currentTokens = 0;

  for (const paragraph of text.split(PARAGRAPH_BREAK).filter((p) => p.trim().length > 0)) {
    const paragraphTokens = estimateTokens(paragraph);
    if (currentTokens + paragraphTokens > CHUNK_MAX_TOKENS && current.length > 0) {
      chunks.push(makeChunk(current.join(PARAGRAPH_JOINER), source, heading, parentHeading, nextIndex()));
      current = trailingOverlap(current);
      currentTokens = current.reduce((sum, p) => sum + estimateTokens(p), 0);
    }
    current.push(paragraph);
    currentTokens += paragraphTokens;
  }
  if (current.length > 0) chunks.push(makeChunk(current.join(PARAGRAPH_JOINER), source, heading, parentHeading, nextIndex()));
  return chunks;
}

/** Ids are stable and readable: `<file>_<heading>_chunk_007`. */
export function makeChunk(text: string, source: string, heading: string, parentHeading: string, index: number): IndexedChunk {
  const baseName = source.replace(/\.md$/i, '').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeHeading = heading.replace(/[^a-zA-Z0-9_-\s]/g, '').trim().slice(0, CHUNK_ID_HEADING_MAX_CHARS).replace(/\s+/g, '-');
  const suffix = `chunk_${String(index).padStart(CHUNK_INDEX_DIGITS, '0')}`;
  return {
    id: safeHeading ? `${baseName}_${safeHeading}_${suffix}` : `${baseName}_${suffix}`,
    text,
    source,
    heading,
    parentHeading,
    tokenCount: estimateTokens(text),
    vector: [],
  };
}
