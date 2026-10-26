import type { EmbeddingProvider } from '../enums/retrieval.enums';

/** A vault chunk returned by search, with what the prompt and citations need. */
export interface CitedChunk {
  chunkId: string;
  text: string;
  source: string;
  heading: string;
  parentHeading: string;
  tokenCount: number;
  /** Vector (cosine) similarity from Pinecone. */
  score?: number;
  /** Cross-encoder relevance in [0, 1], set when the chunk went through the reranker. */
  rerankScore?: number;
}

/** A chunk on its way into the vector index. */
export interface IndexedChunk {
  id: string;
  text: string;
  source: string;
  heading: string;
  parentHeading: string;
  tokenCount: number;
  vector: number[];
}

/** Metadata stored next to each vector in Pinecone. */
export interface ChunkMetadata {
  text: string;
  source: string;
  heading: string;
  parentHeading: string;
  tokenCount: number;
}

/** Retrieval is enabled only when a Pinecone key is configured. */
export interface RetrievalConfig {
  pineconeApiKey: string;
  pineconeIndex: string;
  embeddingProvider: EmbeddingProvider;
  vaultPath: string;
  topK: number;
  embeddingDelayMs: number;
  embeddingBatchSize: number;
}

export interface EmbeddingKeys {
  gemini?: string;
  openai?: string;
}

export interface CitationPrompt {
  systemPrompt: string;
  userContent: string;
}
