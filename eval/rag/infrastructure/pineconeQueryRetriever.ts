import { Pinecone } from '@pinecone-database/pinecone';
import { createEmbeddingService, RAGRetriever } from '../../../src/rag';
import type { QueryRetriever } from '../application/retrievalEvaluation';
import type { RankedChunk } from '../domain';
import type { EvalSettings } from './evalEnv';

export interface IndexInfo {
  dimension: number;
  recordCount: number | null;
}

/**
 * READ-ONLY by construction: only `describeIndex`, `describeIndexStats`,
 * embeddings and `query` are called. It never uses VectorStore.ensureIndex,
 * which deletes and recreates an index whose dimension does not match.
 */
export async function createPineconeQueryRetriever(settings: EvalSettings, topK: number): Promise<{ retriever: QueryRetriever; index: IndexInfo }> {
  const embedder = createEmbeddingService(settings.embeddingProvider, {
    openai: settings.openaiApiKey,
    gemini: settings.geminiApiKey,
  });

  const pinecone = new Pinecone({ apiKey: settings.pineconeApiKey });
  const description = await pinecone.describeIndex(settings.pineconeIndex);
  if (description.dimension !== embedder.dimension) {
    throw new Error(
      `Index "${settings.pineconeIndex}" has dimension ${description.dimension} but ${settings.embeddingProvider} embeddings have ${embedder.dimension}. ` +
      'Set EMBEDDING_PROVIDER to the provider the index was built with.',
    );
  }
  const stats = await pinecone.index(settings.pineconeIndex).describeIndexStats().catch(() => null);

  const rag = new RAGRetriever(
    {
      pineconeApiKey: settings.pineconeApiKey,
      pineconeIndex: settings.pineconeIndex,
      embeddingProvider: settings.embeddingProvider,
      vaultPath: '',
      topK,
      embeddingDelayMs: 0,
      embeddingBatchSize: 1,
    },
    embedder,
  );

  const retriever: QueryRetriever = {
    async retrieve(question: string): Promise<RankedChunk[]> {
      const chunks = await rag.retrieve(question);
      return chunks.map((c) => ({ source: c.source, heading: c.heading, score: c.score ?? 0 }));
    },
  };
  return { retriever, index: { dimension: description.dimension ?? 0, recordCount: stats?.totalRecordCount ?? null } };
}
