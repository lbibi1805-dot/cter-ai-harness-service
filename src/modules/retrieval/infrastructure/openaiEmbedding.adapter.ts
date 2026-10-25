import OpenAI from 'openai';
import type { EmbeddingService } from '../domain/interfaces/embedding.port';
import { EMBEDDING_DIMENSION, EMBEDDING_MODEL } from '../domain/constants/retrieval.constants';
import { EmbeddingProvider } from '../domain/enums/retrieval.enums';

export class OpenAIEmbeddingAdapter implements EmbeddingService {
  readonly provider = EmbeddingProvider.OPENAI;
  readonly dimension = EMBEDDING_DIMENSION[EmbeddingProvider.OPENAI];
  private readonly client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async embed(text: string): Promise<number[]> {
    const [vector] = await this.embedBatch([text]);
    return vector;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const response = await this.client.embeddings.create({ model: EMBEDDING_MODEL[EmbeddingProvider.OPENAI], input: texts });
    return response.data.map((item) => item.embedding);
  }
}
