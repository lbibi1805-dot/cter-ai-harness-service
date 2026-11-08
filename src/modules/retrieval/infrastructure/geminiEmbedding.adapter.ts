import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai';
import { retryTransient } from '../../../shared/resilience/retry';
import type { EmbeddingService } from '../domain/interfaces/embedding.port';
import {
  EMBEDDING_DIMENSION,
  EMBEDDING_MODEL,
  QUERY_EMBEDDING_MAX_RETRIES,
  QUERY_EMBEDDING_RETRY_DELAY_MS,
  QUERY_EMBEDDING_TIMEOUT_MS,
} from '../domain/constants/retrieval.constants';
import { EmbeddingProvider } from '../domain/enums/retrieval.enums';

/**
 * Stays on `@google/generative-ai` on purpose: the vectors in Pinecone were produced through it, and the
 * embedding request must not change underneath an existing index.
 */
export class GeminiEmbeddingAdapter implements EmbeddingService {
  readonly provider = EmbeddingProvider.GEMINI;
  readonly dimension = EMBEDDING_DIMENSION[EmbeddingProvider.GEMINI];
  private readonly model: GenerativeModel;
  /** Same model with a 5 s request timeout, for question embeddings on the answer path. */
  private readonly queryModel: GenerativeModel;

  constructor(apiKey: string) {
    const client = new GoogleGenerativeAI(apiKey);
    const params = { model: EMBEDDING_MODEL[EmbeddingProvider.GEMINI] };
    this.model = client.getGenerativeModel(params);
    this.queryModel = client.getGenerativeModel(params, { timeout: QUERY_EMBEDDING_TIMEOUT_MS });
  }

  /** Question embedding: 5 s per try, one retry on 429/5xx/timeouts (07 §3.3). */
  embed(text: string): Promise<number[]> {
    return retryTransient(() => embedWith(this.queryModel, text), {
      maxAttempts: QUERY_EMBEDDING_MAX_RETRIES + 1,
      backoff: { baseDelayMs: QUERY_EMBEDDING_RETRY_DELAY_MS, maxDelayMs: QUERY_EMBEDDING_RETRY_DELAY_MS, factor: 1 },
    });
  }

  /** Gemini's SDK embeds one text per call; the batch is sent concurrently (the indexer retries). */
  embedBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((text) => embedWith(this.model, text)));
  }
}

async function embedWith(model: GenerativeModel, text: string): Promise<number[]> {
  const result = await model.embedContent(text);
  return result.embedding.values ?? [];
}
