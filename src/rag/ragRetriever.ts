import type { VaultConfig, CitedChunk } from '../types';
import type { IEmbeddingService } from './embeddingService';
import { VectorStore } from './vectorStore';
import { normalizeText } from './textNormalizer';

export class RAGRetriever {
  private vectorStore: VectorStore;
  private embedder: IEmbeddingService;
  private topK: number;

  constructor(
    config: VaultConfig,
    embedder: IEmbeddingService,
  ) {
    this.vectorStore = new VectorStore(
      config.pineconeApiKey,
      config.pineconeIndex,
    );
    this.embedder = embedder;
    this.topK = config.topK ?? 6;
  }

  async retrieve(
    question: string,
  ): Promise<CitedChunk[]> {
    if (!question.trim()) return [];

    const queryVector = await this.embedder.embed(normalizeText(question));
    const chunks = await this.vectorStore.query(queryVector, this.topK);

    return chunks;
  }
}
