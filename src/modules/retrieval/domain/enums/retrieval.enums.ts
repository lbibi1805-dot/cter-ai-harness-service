/** Embedding backend. Must match the Pinecone index dimension, so switching means re-indexing. */
export enum EmbeddingProvider {
  GEMINI = 'gemini',
  OPENAI = 'openai',
}
