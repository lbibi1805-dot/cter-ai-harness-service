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
  // ── answer eval (eval/answers) ──
  /** Neon connection — used with SELECT statements only. */
  DATABASE_URL = 'DATABASE_URL',
  /** OpenAI model that answers in both modes (agent needs a Responses-API model). */
  ANSWER_MODEL = 'ANSWER_MODEL',
  /** Grader model; ideally different from ANSWER_MODEL. */
  JUDGE_MODEL = 'JUDGE_MODEL',
  RAG_TOP_K = 'RAG_TOP_K',
  SYSTEM_PROMPT_FILE = 'SYSTEM_PROMPT_FILE',
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
  MODES = '--modes',
  REPEATS = '--repeats',
  LIMIT = '--limit',
  BASELINE = '--baseline',
  /** Without it the answer eval only prints the plan (it spends real API credits). */
  YES = '--yes',
}

/** Cut-offs reported for every metric; the retriever fetches max(K) once. */
export const DEFAULT_K_VALUES: readonly number[] = [1, 3, 5, 8, 10, 20];
