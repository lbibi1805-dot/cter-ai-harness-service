import MiniSearch from 'minisearch';
import {
  LEXICAL_FIELD_BOOST,
  LEXICAL_FIELDS,
  LEXICAL_MIN_TERM_LENGTH,
  LEXICAL_PREFIX_MIN_LENGTH,
} from '../domain/constants/hybridSearch.constants';
import { QUERY_MAX_CHARS } from '../domain/constants/retrieval.constants';
import { stripDiacritics } from '../domain/helpers/hybridSearch.helper';
import type { LexicalSearch, LexicalSearchOptions } from '../domain/interfaces/lexicalSearch.port';
import type { CitedChunk } from '../domain/interfaces/retrieval.interface';
import type { LexicalIndexDocument } from './interfaces/miniSearchLexicalIndex.interface';

/** Lowercased term (index side); terms too short to carry meaning are dropped. */
function indexTerm(term: string): string | null {
  const lower = term.toLowerCase();
  return lower.length >= LEXICAL_MIN_TERM_LENGTH ? lower : null;
}

/** Query side: the term as typed and without diacritics, so "kiem thu" and "kiểm thử" both match. */
function queryTerms(term: string): string[] | null {
  const lower = indexTerm(term);
  if (!lower) return null;
  const plain = stripDiacritics(lower);
  return plain === lower ? [lower] : [lower, plain];
}

/**
 * BM25 over every live vault chunk, in RAM (MiniSearch, MIT). Two fields per chunk: the text with
 * Vietnamese diacritics and a stripped copy. Ids are the vector index's chunk ids (`<docId>#<hash8>#<idx>`),
 * so results fuse with Pinecone hits and pass the same read-side guard.
 */
export class MiniSearchLexicalIndex implements LexicalSearch {
  private readonly engine = new MiniSearch<LexicalIndexDocument>({
    fields: [...LEXICAL_FIELDS],
    processTerm: indexTerm,
  });
  private readonly chunks = new Map<string, CitedChunk>();
  /** docId → indexed content hash and its chunk ids. */
  private readonly documents = new Map<string, { hash: string; chunkIds: string[] }>();

  get chunkCount(): number {
    return this.chunks.size;
  }

  get documentCount(): number {
    return this.documents.size;
  }

  /** The content hash indexed for `docId`, if any. */
  hashOf(docId: string): string | undefined {
    return this.documents.get(docId)?.hash;
  }

  docIds(): string[] {
    return [...this.documents.keys()];
  }

  /** Swaps a document's chunks for a new version (or adds it). */
  replaceDocument(docId: string, hash: string, chunks: CitedChunk[]): void {
    this.removeDocument(docId);
    const fresh = chunks.filter((chunk) => !this.chunks.has(chunk.chunkId));
    this.engine.addAll(fresh.map((chunk) => ({ id: chunk.chunkId, text: chunk.text, plain: stripDiacritics(chunk.text) })));
    for (const chunk of fresh) this.chunks.set(chunk.chunkId, chunk);
    this.documents.set(docId, { hash, chunkIds: fresh.map((chunk) => chunk.chunkId) });
  }

  removeDocument(docId: string): void {
    const existing = this.documents.get(docId);
    if (!existing) return;
    for (const id of existing.chunkIds) {
      if (this.engine.has(id)) this.engine.discard(id);
      this.chunks.delete(id);
    }
    this.documents.delete(docId);
  }

  search(query: string, limit: number, options: LexicalSearchOptions = {}): CitedChunk[] {
    const text = query.slice(0, QUERY_MAX_CHARS).trim();
    if (!text || limit <= 0 || this.chunks.size === 0) return [];
    const { sourceFilter } = options;
    const hits = this.engine.search(text, {
      boost: { ...LEXICAL_FIELD_BOOST },
      prefix: (term) => term.length >= LEXICAL_PREFIX_MIN_LENGTH,
      processTerm: queryTerms,
      ...(sourceFilter ? { filter: (result) => sourceFilter(this.chunks.get(String(result.id))?.source ?? '') } : {}),
    });
    return hits.slice(0, limit).flatMap((hit) => {
      const chunk = this.chunks.get(String(hit.id));
      return chunk ? [chunk] : [];
    });
  }
}
