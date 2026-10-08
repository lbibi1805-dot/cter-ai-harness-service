/**
 * Names of the variables read from `eval/.env.eval`. Only the NAMES live in
 * code — the values (production Pinecone credentials) stay in the gitignored
 * env file so they can never be committed.
 */
export enum EvalEnvKey {
  PINECONE_API_KEY = 'PINECONE_API_KEY',
  PINECONE_INDEX = 'PINECONE_INDEX',
  EMBEDDING_PROVIDER = 'EMBEDDING_PROVIDER',
  OPENAI_API_KEY = 'OPENAI_API_KEY',
  GEMINI_API_KEY = 'GEMINI_API_KEY',
}

/** Must match the provider the production index was built with. */
export enum EvalEmbeddingProvider {
  OPENAI = 'openai',
  GEMINI = 'gemini',
}

export enum EvalCliFlag {
  GOLDEN = '--golden',
  K = '--k',
  LABEL = '--label',
  ENV = '--env',
}

/** Cut-offs reported for every metric; the retriever fetches max(K) once. */
export const DEFAULT_K_VALUES: readonly number[] = [1, 3, 5, 8, 10, 20];
