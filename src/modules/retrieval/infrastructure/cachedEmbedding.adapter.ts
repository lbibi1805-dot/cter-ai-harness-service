import type { EmbeddingService } from '../domain/interfaces/embedding.port';
import { QUERY_VECTOR_CACHE_SIZE } from '../domain/constants/retrieval.constants';

/**
 * Keeps the last question vectors in memory (LRU): a repeated or retried question skips the embedding call.
 * Only `embed` (questions) is cached; indexing batches go straight through.
 */
export class CachedEmbeddingService implements EmbeddingService {
  private readonly cache = new Map<string, number[]>();

  constructor(
    private readonly inner: EmbeddingService,
    private readonly capacity: number = QUERY_VECTOR_CACHE_SIZE,
  ) {}

  get dimension(): number {
    return this.inner.dimension;
  }

  get provider() {
    return this.inner.provider;
  }

  async embed(text: string): Promise<number[]> {
    const cached = this.cache.get(text);
    if (cached) {
      this.cache.delete(text);
      this.cache.set(text, cached);
      return cached;
    }
    const vector = await this.inner.embed(text);
    this.cache.set(text, vector);
    if (this.cache.size > this.capacity) this.cache.delete(this.cache.keys().next().value as string);
    return vector;
  }

  embedBatch(texts: string[]): Promise<number[][]> {
    return this.inner.embedBatch(texts);
  }
}
