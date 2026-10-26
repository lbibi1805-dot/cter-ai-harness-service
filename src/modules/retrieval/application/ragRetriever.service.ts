import { attempt } from '../../../shared/resilience/attempt';
import type { EmbeddingService } from '../domain/interfaces/embedding.port';
import { QUERY_FALLBACK_MAX_CHARS, QUERY_MAX_CHARS } from '../domain/constants/retrieval.constants';
import type { CitedChunk } from '../domain/interfaces/retrieval.interface';
import { normalizeText } from '../domain/textNormalizer';
import type { VectorStore } from '../domain/interfaces/vectorStore.port';
import { isContextLengthError } from '../domain/helpers/retrieval.helper';

/** Vector search over the vault: embed the question, return the top-K chunks. */
export class RAGRetriever {
  constructor(
    private readonly vectorStore: VectorStore,
    private readonly embedder: EmbeddingService,
    private readonly topK: number,
  ) {}

  async retrieve(question: string): Promise<CitedChunk[]> {
    if (!question.trim()) return [];
    const vector = await this.embedQuestion(question);
    return this.vectorStore.query(vector, this.topK);
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
