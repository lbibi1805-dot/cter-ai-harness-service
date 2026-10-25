import type { EmbeddingProvider } from '../enums/retrieval.enums';

export interface EmbeddingService {
  readonly dimension: number;
  readonly provider: EmbeddingProvider;
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}
