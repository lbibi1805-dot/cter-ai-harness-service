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

    // Embedding limits: OpenAI 8192 tokens, Gemini ~2048 tokens. Truncate long
    // inputs (e.g. full PDF text) to avoid 400 "maximum context length" and
    // fallback to knowledge.md. Keep first 4000 chars (~1000 tokens) which is
    // enough for retrieval and safe for both providers.
    // Retry with even shorter query if first attempt fails due to length.
    const truncate = (text: string, max: number) => text.length > max ? text.slice(0, max) : text;
    const tryEmbed = async (text: string) => this.embedder.embed(normalizeText(text));

    let queryVector: number[];
    try {
      queryVector = await tryEmbed(truncate(question, 4000));
    } catch (err) {
      const msg = (err as Error).message ?? '';
      if (msg.includes('maximum context length') || msg.includes('too long') || msg.includes('8192') || msg.includes('2048')) {
        // Retry with shorter query (2000 chars)
        queryVector = await tryEmbed(truncate(question, 2000));
      } else {
        throw err;
      }
    }
    const chunks = await this.vectorStore.query(queryVector, this.topK);

    return chunks;
  }
}
