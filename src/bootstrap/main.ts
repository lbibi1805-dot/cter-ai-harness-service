import { createAgentModule, createToolCallingModelFactory } from '../modules/agent';
import { createAiModule } from '../modules/ai';
import { createC4Module } from '../modules/c4';
import { createChatModule } from '../modules/chat';
import { createConversationPoller } from '../modules/conversation';
import { createFileQaJob } from '../modules/fileqa';
import { createNotifier } from '../modules/notification';
import { createOpsModule } from '../modules/ops';
import { createPollingModule } from '../modules/polling';
import { createRerankModule } from '../modules/rerank';
import { RetrievalController, RetrievalQueryService, createRetrievalModule, createRetrievalRoutes } from '../modules/retrieval';
import { createVaultModule } from '../modules/vault';
import { createConversationStoreModule } from '../modules/conversation-store';
import { createContextModule } from '../modules/context';
import { createObjectStorage } from '../shared/storage';
import { Router } from '../shared/http/router';
import { logger } from '../shared/logging/logger';
import { StateManager } from '../shared/state/processingStateStore';
import { loadConfig } from './config/loadConfig';
import { STALE_RETRY_MARGIN } from './constants/bootstrap.constants';
import { HttpServer } from './httpServer';
import { logConfiguration } from './startup/configurationReport';
import { buildOpsStatusSource } from './startup/opsStatusSource';
import { indexVaultAndEnableRag } from './startup/ragWarmup';

/** Composition root: builds every module from the config, then starts the HTTP server and polling. */
export async function main(): Promise<void> {
  // 1. Configuration and shared state
  const config = loadConfig();
  const ai = createAiModule({ ai: config.ai, systemPrompt: config.prompts.systemPrompt, knowledgeContent: config.prompts.knowledgeContent });
  logConfiguration(config, ai);
  const state = new StateManager();
  state.load();
  const notifier = createNotifier(config.gmail);

  // 2. Retrieval, reranking and the document vault
  const retrieval = config.retrieval
    ? createRetrievalModule(config.retrieval, { gemini: config.ai.keys.gemini, openai: config.ai.keys.openai })
    : null;
  const ranking = createRerankModule(config.rerank, { pineconeApiKey: config.retrieval?.pineconeApiKey });
  // One bucket per environment (R2) — or a local folder in dev; prefixes split vault files and conversation artifacts.
  const storage = createObjectStorage(config.storage);
  const vault = createVaultModule({ database: config.database, adminToken: config.http.adminToken }, { retrieval, storage });

  // 3. Answering: single-shot by default; `_agent` files / `mode: agent` requests use the agent with fallback
  const agent = createAgentModule(
    { limits: config.agent, systemPrompt: config.prompts.systemPrompt },
    {
      singleShot: ai.invocation,
      vaultRepository: vault.repository,
      vaultDocuments: vault.service,
      createModel: createToolCallingModelFactory(config.ai, ai.configuredAdapters.openRouterClient()),
      retrieval,
      ranking,
    },
  );

  // 4. Server-side conversations + context engineering (API path only; the Canvas poller is unchanged)
  const isProviderConfigured = (provider: Parameters<typeof ai.configuredAdapters.isConfigured>[0]) => ai.configuredAdapters.isConfigured(provider);
  const conversations = createConversationStoreModule(
    { enabled: config.context.conversationStoreEnabled, purgeDays: config.context.purgeDays, database: config.database, chatApiToken: config.http.chatApiToken, adminToken: config.http.adminToken },
    { storage },
  );
  const context = conversations.store && conversations.service
    ? createContextModule(
        { settings: config.context.settings, aux: config.context.aux, timeouts: config.context.timeouts, systemPrompt: config.prompts.systemPrompt },
        { invocation: ai.invocation, store: conversations.store, conversations: conversations.service, isProviderConfigured },
      )
    : null;

  // 5. HTTP APIs for clients
  const chat = createChatModule(
    { chatApiToken: config.http.chatApiToken },
    { answers: agent.clientAnswers, catalog: ai.catalog, agentEnabled: agent.enabled, isProviderConfigured, turns: context?.turns },
  );
  const retrievalQueries = new RetrievalQueryService({
    enabled: chat.enabled,
    vectorSearch: retrieval ? { defaultTopK: retrieval.config.topK, createRetriever: retrieval.createRetriever } : null,
    reranker: ranking,
    productionRetriever: () => ai.rag.current()?.retriever ?? null,
  });
  const retrieveRouter = new Router(createRetrievalRoutes(new RetrievalController(retrievalQueries)), config.http.chatApiToken);
  const c4 = createC4Module(
    { ...config.c4, chatApiToken: config.http.chatApiToken },
    {
      invocation: ai.invocation,
      catalog: ai.catalog,
      currentRetriever: () => ai.rag.current()?.retriever ?? null,
      conversationStore: conversations.store,
      conversations: context?.c4Recorder ?? null,
    },
  );

  // 6. Canvas polling jobs and ops endpoints
  // File Q&A renders a PDF (loose math normalization there); Canvas replies get the client-formatted text.
  const jobDeps = { catalog: ai.catalog, state, answers: agent.answers };
  const staleThresholdMs = config.ai.timeoutMs * (config.ai.maxRetryCount + STALE_RETRY_MARGIN);
  const polling = createPollingModule(
    { intervalMs: config.polling.intervalMs, accounts: config.accounts, database: config.database, adminToken: config.http.adminToken },
    {
      jobs: [createFileQaJob(config.canvasFolders, { ...jobDeps, notifier }), createConversationPoller({ ...jobDeps, answers: agent.clientAnswers })],
      validateKeys: () => ai.configuredAdapters.validateKeys(),
      beforeTick: () => {
        for (const record of state.resetStaleProcessing(staleThresholdMs)) logger.staleReset(record.fileName, record.updatedAt);
      },
    },
  );
  const ops = createOpsModule(
    { port: config.http.port, heartbeat: config.heartbeat, adminToken: config.http.adminToken },
    buildOpsStatusSource(config, ai, polling, vault, storage),
  );

  // 7. Start: the API first so the host (Render) detects the open port right away
  const server = new HttpServer(config.http.port, [vault.router, polling.router, chat.router, conversations.router, retrieveRouter, c4.router, ops.router], config.http.corsOrigins);
  logger.startup(config.accounts.length, config.polling.intervalMs);
  await server.start();
  // Polling starts on boot so a redeploy never leaves it silently stopped; POLL_AUTOSTART=false waits for GET /start.
  if (config.polling.autostart) polling.scheduler.start();
  else logger.info('POLL_AUTOSTART=false — waiting for GET /start');
  ops.heartbeat.start();
  if (retrieval) void indexVaultAndEnableRag({ vault, retrieval, ranking, ai, rerankTopN: config.rerank.topN });
  else void vault.repository.refresh().catch(() => undefined);
}
