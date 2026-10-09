import { Pinecone } from '@pinecone-database/pinecone';
import { createAgentModule } from '../../../src/modules/agent';
import type { Answerer } from '../../../src/modules/agent/domain';
import { AIInvocationService, PromptPreparer, type RagRefs } from '../../../src/modules/ai';
import type { VaultRepository } from '../../../src/modules/vault/domain';
import { CitationPromptBuilder, RAGRetriever, createEmbeddingService } from '../../../src/rag';
import { StorageProvider } from '../../../src/shared/database/database.enums';
import type { AppConfig } from '../../../src/types';
import type { TextEmbedder } from '../application/ports';
import type { EnvironmentSnapshot } from '../domain';
import type { AnswerEvalSettings } from './answerEvalEnv';

const EVAL_MAX_RETRY_COUNT = 2;
const EVAL_AI_TIMEOUT_MS = 120_000;
const EMBED_INPUT_CHARS = 8_000;

/**
 * The service configuration the evaluation runs with — same code paths as
 * production, but no model fallback chain so each mode is measured on exactly
 * ANSWER_MODEL (a silent fallback would hide regressions).
 */
export function buildEvalAppConfig(settings: AnswerEvalSettings): AppConfig {
  return {
    accounts: [],
    aiKeys: { openai: settings.openaiApiKey, gemini: settings.geminiApiKey },
    defaultModels: { claude: '', gemini: '', grok: '', openai: settings.answerModel },
    modelFallback: { claude: [], gemini: [], grok: [], openai: [] },
    pollIntervalMs: 0,
    maxRetryCount: EVAL_MAX_RETRY_COUNT,
    systemPrompt: settings.systemPrompt,
    knowledgeContent: '',
    grokBaseUrl: '',
    aiTimeoutMs: EVAL_AI_TIMEOUT_MS,
    gmail: {},
    vaultConfig: {
      pineconeApiKey: settings.pineconeApiKey,
      pineconeIndex: settings.pineconeIndex,
      embeddingProvider: settings.embeddingProvider,
      vaultPath: '',
      topK: settings.ragTopK,
      embeddingDelayMs: 0,
      embeddingBatchSize: 1,
    },
    database: { provider: StorageProvider.NEON, databaseUrl: settings.databaseUrl },
    pollAutostart: false,
    agent: { maxToolCalls: 6, maxDurationMs: 180_000 },
    canvasFolder: { materials: '', input: '', output: '' },
  };
}

/** Wires the answer path exactly like src/index.ts (single-shot with RAG + agent with fallback). */
export function createProductionAnswerer(config: AppConfig, vaultRepository: VaultRepository): Answerer {
  const vault = config.vaultConfig!;
  const embedder = createEmbeddingService(vault.embeddingProvider, { openai: config.aiKeys.openai, gemini: config.aiKeys.gemini });
  const ragRefs: RagRefs = { retriever: new RAGRetriever(vault, embedder), builder: new CitationPromptBuilder() };
  const ai = new AIInvocationService(config, new PromptPreparer(config.systemPrompt, config.knowledgeContent, () => ragRefs));
  return createAgentModule(config, { ai, vaultRepository }).answers;
}

export function createTextEmbedder(settings: AnswerEvalSettings): TextEmbedder {
  const embedder = createEmbeddingService(settings.embeddingProvider, { openai: settings.openaiApiKey, gemini: settings.geminiApiKey });
  return { embed: (text) => embedder.embed(text.slice(0, EMBED_INPUT_CHARS)) };
}

/** What the answers were computed against — compared across runs to spot data drift. */
export async function captureEnvironment(settings: AnswerEvalSettings, vaultRepository: VaultRepository): Promise<EnvironmentSnapshot> {
  const stats = await vaultRepository.stats().catch(() => null);
  const pinecone = new Pinecone({ apiKey: settings.pineconeApiKey });
  const index = await pinecone.index(settings.pineconeIndex).describeIndexStats().catch(() => null);
  return {
    vaultFiles: stats?.total ?? null,
    vaultIndexed: stats?.indexed ?? null,
    vectorCount: index?.totalRecordCount ?? null,
    embeddingProvider: settings.embeddingProvider,
    pineconeIndex: settings.pineconeIndex,
  };
}
