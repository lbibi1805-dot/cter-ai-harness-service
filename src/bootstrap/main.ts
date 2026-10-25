import { createAgentModule, createToolCallingModelFactory } from '../modules/agent';
import { createAiModule } from '../modules/ai';
import { createChatModule } from '../modules/chat';
import { createConversationPoller } from '../modules/conversation';
import { createFileQaJob } from '../modules/fileqa';
import { createNotifier } from '../modules/notification';
import { createOpsModule } from '../modules/ops';
import { createPollingModule } from '../modules/polling';
import { createRerankModule } from '../modules/rerank';
import { DEFAULT_VAULT_PATH, RetrievalController, RetrievalQueryService, createRetrievalModule, createRetrievalRoutes } from '../modules/retrieval';
import { createVaultModule } from '../modules/vault';
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
  const vault = createVaultModule(
    { database: config.database, vaultPath: config.retrieval?.vaultPath ?? DEFAULT_VAULT_PATH, adminToken: config.http.adminToken },
    { retrieval },
  );

  // 3. Answering: single-shot by default; `_agent` files / `mode: agent` requests use the agent with fallback
  const agent = createAgentModule(
    { limits: config.agent, systemPrompt: config.prompts.systemPrompt },
    {
      singleShot: ai.invocation,
      vaultRepository: vault.repository,
      createModel: createToolCallingModelFactory(config.ai, ai.configuredAdapters.openRouterClient()),
      retrieval,
      ranking,
    },
  );

  // 4. HTTP APIs for clients
  const chat = createChatModule(
    { chatApiToken: config.http.chatApiToken },
    { answers: agent.answers, catalog: ai.catalog, agentEnabled: agent.enabled, isProviderConfigured: (provider) => ai.configuredAdapters.isConfigured(provider) },
  );
  const retrievalQueries = new RetrievalQueryService({
    enabled: chat.enabled,
    vectorSearch: retrieval ? { defaultTopK: retrieval.config.topK, createRetriever: retrieval.createRetriever } : null,
    reranker: ranking,
    productionRetriever: () => ai.rag.current()?.retriever ?? null,
  });
  const retrieveRouter = new Router(createRetrievalRoutes(new RetrievalController(retrievalQueries)), config.http.chatApiToken);

  // 5. Canvas polling jobs and ops endpoints
  const jobDeps = { catalog: ai.catalog, state, answers: agent.answers };
  const staleThresholdMs = config.ai.timeoutMs * (config.ai.maxRetryCount + STALE_RETRY_MARGIN);
  const polling = createPollingModule(
    { intervalMs: config.polling.intervalMs, accounts: config.accounts, database: config.database, adminToken: config.http.adminToken },
    {
      jobs: [createFileQaJob(config.canvasFolders, { ...jobDeps, notifier }), createConversationPoller(jobDeps)],
      validateKeys: () => ai.configuredAdapters.validateKeys(),
      beforeTick: () => {
        for (const record of state.resetStaleProcessing(staleThresholdMs)) logger.staleReset(record.fileName, record.updatedAt);
      },
    },
  );
  const ops = createOpsModule(
    { port: config.http.port, heartbeat: config.heartbeat, adminToken: config.http.adminToken },
    buildOpsStatusSource(config, ai, polling, vault),
  );

  // 6. Start: the API first so the host (Render) detects the open port right away
  const server = new HttpServer(config.http.port, [vault.router, polling.router, chat.router, retrieveRouter, ops.router], config.http.corsOrigins);
  logger.startup(config.accounts.length, config.polling.intervalMs);
  await server.start();
  // Polling starts on boot so a redeploy never leaves it silently stopped; POLL_AUTOSTART=false waits for GET /start.
  if (config.polling.autostart) polling.scheduler.start();
  else logger.info('POLL_AUTOSTART=false — waiting for GET /start');
  ops.heartbeat.start();
  if (retrieval) void indexVaultAndEnableRag({ vault, retrieval, ranking, ai, rerankTopN: config.rerank.topN });
}
