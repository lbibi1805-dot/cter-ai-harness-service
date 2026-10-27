import type { ChunkRetriever } from '../../rerank';
import type { CitedChunk } from '../../retrieval';
import type { C4KnowledgeSource } from '../application/interfaces/c4Sketch.interface';

/** The production retriever (vault RAG), read on every call because it becomes ready after startup indexing. */
export class RagKnowledgeAdapter implements C4KnowledgeSource {
  constructor(private readonly currentRetriever: () => ChunkRetriever | null) {}

  async search(query: string): Promise<CitedChunk[]> {
    const retriever = this.currentRetriever();
    return retriever ? retriever.retrieve(query) : [];
  }
}
