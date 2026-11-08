import OpenAI from 'openai';
import type { EmbeddingService } from '../domain/interfaces/embedding.port';
import {
  EMBEDDING_DIMENSION,
  EMBEDDING_MODEL,
  QUERY_EMBEDDING_MAX_RETRIES,
  QUERY_EMBEDDING_TIMEOUT_MS,
} from '../domain/constants/retrieval.constants';
import { EmbeddingProvider } from '../domain/enums/retrieval.enums';

export class OpenAIEmbeddingAdapter implements EmbeddingService {
  readonly provider = EmbeddingProvider.OPENAI;
  readonly dimension = EMBEDDING_DIMENSION[EmbeddingProvider.OPENAI];
  private readonly client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  /** Question embedding on the answer path: 5 s per try and a single retry (07 §3.3). */
  async embed(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create(
      { model: EMBEDDING_MODEL[EmbeddingProvider.OPENAI], input: [text] },
      { timeout: QUERY_EMBEDDING_TIMEOUT_MS, maxRetries: QUERY_EMBEDDING_MAX_RETRIES },
    );
    return response.data[0].embedding;
  }

  /** Indexing batches keep the SDK defaults (large inputs, the indexer has its own retries). */
  async embedBatch(texts: string[]): Promise<number[][]> {
    const response = await this.client.embeddings.create({ model: EMBEDDING_MODEL[EmbeddingProvider.OPENAI], input: texts });
    return response.data.map((item) => item.embedding);
  }
}
