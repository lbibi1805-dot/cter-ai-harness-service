import { attempt } from '../../../shared/resilience/attempt';
import type { EmbeddingService } from '../domain/interfaces/embedding.port';
import { QUERY_FALLBACK_MAX_CHARS, QUERY_MAX_CHARS } from '../domain/constants/retrieval.constants';
import type { ChunkGuard, CitedChunk } from '../domain/interfaces/retrieval.interface';
import { normalizeText } from '../domain/textNormalizer';
import type { VectorStore } from '../domain/interfaces/vectorStore.port';
import { isContextLengthError, dropLowScores } from '../domain/helpers/retrieval.helper';
import { reciprocalRankFusion } from '../domain/helpers/hybridSearch.helper';
import type { LexicalSearch } from '../domain/interfaces/lexicalSearch.port';

/**
 * Vector search over the vault: embed the question, return the top-K chunks. With a lexical (BM25) index
 * (HYBRID_SEARCH_ENABLED), its top-K is fused with the vector hits by reciprocal rank fusion (15 §3.2):
 * exact terms (standard codes, API names) that the embedding misses still make it into the candidates.
 */
export class RAGRetriever {
  constructor(
    private readonly vectorStore: VectorStore,
    private readonly embedder: EmbeddingService,
    private readonly topK: number,
    /** Drops chunks of deleted/superseded vault documents (the manifest decides, not the index). */
    private readonly guard: ChunkGuard = (chunks) => chunks,
    /** RAG_MIN_SCORE; 0 keeps everything. */
    private readonly minScore: number = 0,
    /** BM25 in RAM; absent = vector only. */
    private readonly lexical?: LexicalSearch,
  ) {}

  async retrieve(question: string): Promise<CitedChunk[]> {
    if (!question.trim()) return [];
    const vector = await this.embedQuestion(question);
    const vectorHits = dropLowScores(this.guard(await this.vectorStore.query(vector, this.topK)), this.minScore);
    const lexicalHits = this.lexical ? this.guard(this.lexical.search(normalizeText(question), this.topK)) : [];
    if (lexicalHits.length === 0) return vectorHits;
    return reciprocalRankFusion([vectorHits, lexicalHits]).slice(0, this.topK);
  }

  /** Long inputs (a whole exam file) are cut; a "too long" rejection is retried once, shorter. */
  private async embedQuestion(question: string): Promise<number[]> {
    const first = await attempt(() => this.embedTruncated(question, QUERY_MAX_CHARS));
    if (first.ok) return first.value;
    if (!isContextLengthError(first.error)) throw first.error;
    return this.embedTruncated(question, QUERY_FALLBACK_MAX_CHARS);
  }

  private embedTruncated(question: string, maxChars: number): Promise<number[]> {
    return this.embedder.embed(normalizeText(question.slice(0, maxChars)));
  }
}
