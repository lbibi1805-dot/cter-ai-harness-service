import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai';
import type { EmbeddingService } from '../domain/interfaces/embedding.port';
import { EMBEDDING_DIMENSION, EMBEDDING_MODEL } from '../domain/constants/retrieval.constants';
import { EmbeddingProvider } from '../domain/enums/retrieval.enums';

export class GeminiEmbeddingAdapter implements EmbeddingService {
  readonly provider = EmbeddingProvider.GEMINI;
  readonly dimension = EMBEDDING_DIMENSION[EmbeddingProvider.GEMINI];
  private readonly model: GenerativeModel;

  constructor(apiKey: string) {
    this.model = new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: EMBEDDING_MODEL[EmbeddingProvider.GEMINI] });
  }

  async embed(text: string): Promise<number[]> {
    const result = await this.model.embedContent(text);
    return result.embedding.values ?? [];
  }

  /** Gemini's SDK embeds one text per call; the batch is sent concurrently. */
  embedBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((text) => this.embed(text)));
  }
}
