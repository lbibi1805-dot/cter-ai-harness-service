import * as path from 'path';
import { COMPOSED_PATHS, EVAL_RESULTS_DIR, listEvalResults, type PromptPath } from '../modules/prompts';
import { ClientAnswerService, createAgentModule, createToolCallingModelFactory } from '../modules/agent';
import { DEFAULT_AI_LATENCY, configureHistoryLimits, createAiModule } from '../modules/ai';
import { createC4Module } from '../modules/c4';
import { AnswerOrchestrator, answerPromptsFrom, createChatModule } from '../modules/chat';
import { createConversationPoller } from '../modules/conversation';
import { createFileQaJob } from '../modules/fileqa';
import { createNotifier } from '../modules/notification';
import { createOpsModule } from '../modules/ops';
import { SHUTDOWN_SIGNALS, createPollingModule } from '../modules/polling';
import { createRerankModule } from '../modules/rerank';
import { RetrievalController, RetrievalQueryService, createRetrievalModule, createRetrievalRoutes } from '../modules/retrieval';
import { createVaultModule } from '../modules/vault';
import { createConversationStoreModule } from '../modules/conversation-store';
import { createContextModule } from '../modules/context';
import { createRoutingModule } from '../modules/routing';
import { createCaptureModule } from '../modules/capture';
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
import { buildEssayService } from './startup/essayWiring';
import { buildDiagramWiring, diagramGuardMetrics } from './startup/diagramWiring';
import { legacyPromptInSync } from './startup/legacyPrompt';

/** Composition root: builds every module from the config, then starts the HTTP server and polling. */
export async function main(): Promise<void> {
  // 1. Configuration and shared state
  const config = loadConfig();
  // 12/11 plan 08 Bước 5: the newest assistant turn keeps HISTORY_ASSISTANT_TURN_MAX_CHARS in every history.
  configureHistoryLimits({ lastAssistantTurnMaxChars: config.historyAssistantTurnMaxChars });
  // Static system prompt (layer ①): `prompts/` registry when present, else system-prompt.md. Domains/skills: config.prompts.registry.
  logger.info(`[prompts] ${config.prompts.registry ? 'registry' : 'system-prompt.md'} · promptVersion ${config.prompts.promptVersion ?? '-'}`);
  const promptLayout = config.context.settings.promptLayout;
  const ai = createAiModule({ ai: { ...config.ai, ...(config.chat ? { geminiInlineImagesMaxBytes: config.chat.geminiInlineImagesMaxBytes } : {}) }, systemPrompt: config.prompts.systemPrompt, knowledgeContent: config.prompts.knowledgeContent, promptLayout, reminder: config.prompts.reminder });
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
  // 12/11 plan 03: PlantUML render (validate_diagram tool, post-answer guard, /api/c4/render) + aux repair.
  const isProviderConfigured = (provider: Parameters<typeof ai.configuredAdapters.isConfigured>[0]) => ai.configuredAdapters.isConfigured(provider);
  const diagrams = buildDiagramWiring(config, ai, isProviderConfigured);
  const agent = createAgentModule(
    {
      limits: config.agent, systemPrompt: config.prompts.systemPrompt, promptLayout,
      researchMode: config.prompts.researchMode, reminder: config.prompts.reminder, diagramGuard: config.diagramGuard,
    },
    {
      diagramValidator: diagrams.validator,
      diagramRepairer: diagrams.repairer,
      singleShot: ai.invocation,
      vaultRepository: vault.repository,
      vaultDocuments: vault.service,
      createModel: createToolCallingModelFactory(config.ai, ai.configuredAdapters.openRouterClient()),
      retrieval,
      ranking,
    },
  );

  // 12/11 plan 08: every text answer (chat, Canvas replies, file Q&A) answers ALL questions of the prompt, long enough —
  // answer plan, sections, auto-continue, coverage fix. ANSWER_COMPLETENESS_ENABLED=false passes requests through.
  const skillBody = config.prompts.registry ? (id: string) => config.prompts.registry!.skill(id)?.body ?? null : null;
  const orchestrator = new AnswerOrchestrator(agent.answers, config.answers ?? {}, answerPromptsFrom(skillBody));
  const clientAnswers = new ClientAnswerService(orchestrator, agent.diagramGuard);

  // 4. Server-side conversations + context engineering (API path only; the Canvas poller is unchanged)
  const conversations = createConversationStoreModule(
    { enabled: config.context.conversationStoreEnabled, purgeDays: config.context.purgeDays, database: config.database, chatApiToken: config.http.chatApiToken, adminToken: config.http.adminToken },
    { storage },
  );
  // Intent router (note 05 §2): rules first; its one combined aux call (intent + refs) is also step ③ of the artifact resolver (17 §3.3).
  const routing = createRoutingModule(
    {
      aux: config.context.aux,
      timeoutMs: config.context.settings.resolver.auxTimeoutMs,
      skills: config.prompts.registry ? (id) => config.prompts.registry!.skill(id)?.body ?? null : null,
    },
    { invocation: ai.invocation, isProviderConfigured },
  );
  const context = conversations.store && conversations.service
    ? createContextModule(
        { settings: config.context.settings, aux: config.context.aux, timeouts: config.context.timeouts, systemPrompt: config.prompts.systemPrompt },
        { invocation: ai.invocation, store: conversations.store, conversations: conversations.service, isProviderConfigured, auxResolver: routing.auxResolver },
      )
    : null;

  // 5. HTTP APIs for clients (Essay Mode: note 15)
  const essay = buildEssayService(config, { ai, retrieval, ranking, vault, isProviderConfigured });
  const chat = createChatModule(
    { chatApiToken: config.http.chatApiToken, limits: config.chat },
    {
      answers: clientAnswers, catalog: ai.catalog, agentEnabled: agent.enabled, isProviderConfigured, turns: context?.turns, storage,
      ...(config.prompts.registry ? { promptTrace: (p: string) => config.prompts.registry!.composition(p as PromptPath) } : {}),
      ...(essay ? { essay } : {}),
      // Essay Mode: the router's one aux call also returns the essay analysis (note 15 step ①).
      essayAux: ({ imageCount }) => routing.router.essaySession({ imageCount, designCount: 0 }, config.essay.analysisTimeoutMs),
    },
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
      uploads: chat.uploads,
      currentRetriever: () => ai.rag.current()?.retriever ?? null,
      conversationStore: conversations.store,
      imageStorage: storage,
      conversations: context?.c4Recorder ?? null,
      router: routing.router,
      aux: routing.auxModel,
      skills: config.prompts.registry ? (id) => config.prompts.registry!.skill(id)?.body ?? null : null,
      sharedRules: config.prompts.c4Rules,
      reminder: config.prompts.reminder,
      ...(config.http.chatApiToken ? { render: diagrams.render } : {}),
      resolver: config.context.settings.resolver,
    },
  );

  // 6. Canvas polling jobs and ops endpoints
  // File Q&A renders a PDF (loose math normalization there); Canvas replies get the client-formatted text.
  // Canvas polling is background work (long PDF answers): CANVAS_DEADLINE_MS instead of the interactive CHAT_DEADLINE_MS.
  const jobDeps = { catalog: ai.catalog, state, answers: orchestrator, deadlineMs: config.ai.latency?.canvasDeadlineMs ?? DEFAULT_AI_LATENCY.canvasDeadlineMs };
  const staleThresholdMs = config.ai.timeoutMs * (config.ai.maxRetryCount + STALE_RETRY_MARGIN);
  const polling = createPollingModule(
    { intervalMs: config.polling.intervalMs, accounts: config.accounts, database: config.database, adminToken: config.http.adminToken, cursorFlushMs: config.polling.cursorFlushMs },
    {
      jobs: [createFileQaJob(config.canvasFolders, { ...jobDeps, notifier }), createConversationPoller({ ...jobDeps, answers: clientAnswers })],
      validateKeys: () => ai.configuredAdapters.validateKeys(),
      beforeTick: () => {
        for (const record of state.resetStaleProcessing(staleThresholdMs)) logger.staleReset(record.fileName, record.updatedAt);
      },
    },
  );
  const legacyInSync = config.prompts.registry ? legacyPromptInSync(config.prompts.registry.systemPrompt) : null;
  const ops = createOpsModule(
    { port: config.http.port, heartbeat: config.heartbeat, adminToken: config.http.adminToken },
    buildOpsStatusSource(config, ai, polling, vault, storage, {
      latency: (windowMs) => ({ ...ai.metrics.summary(windowMs), diagramGuard: diagramGuardMetrics(agent.diagramGuard?.stats() ?? null, c4.service.connectivityStats()), answers: orchestrator.metrics.summary() }),
      circuit: () => ai.circuit.snapshot(),
      prompts: config.prompts.registry
        ? () => ({
          promptVersion: config.prompts.promptVersion,
          prompts: config.prompts.registry!.list(),
          // 12/11 02 Bước 6: composition order per path + whether system-prompt.md (rollback copy) is current.
          compositions: Object.fromEntries(COMPOSED_PATHS.map((p) => [p, config.prompts.registry!.composition(p)])),
          legacyInSync,
        })
        : undefined,
      evals: (kind) => listEvalResults(path.resolve(process.cwd(), EVAL_RESULTS_DIR), kind),
    }),
  );

  // Photo capture (planning-13112026-photo-capture): /api/captures for the cter-capture-client web app; shared key, no database.
  const capture = config.capture ? createCaptureModule(config.capture, { adminToken: config.http.adminToken }) : null;

  // 7. Start: the API first so the host (Render) detects the open port right away
  const server = new HttpServer(config.http.port, [vault.router, polling.router, chat.router, conversations.router, retrieveRouter, c4.router, ops.router, ...(capture ? [capture.router] : [])], config.http.corsOrigins);
  logger.startup(config.accounts.length, config.polling.intervalMs);
  await server.start();
  // Polling starts on boot so a redeploy never leaves it silently stopped; POLL_AUTOSTART=false waits for GET /start.
  if (config.polling.autostart) polling.scheduler.start();
  else logger.info('POLL_AUTOSTART=false — waiting for GET /start');
  ops.heartbeat.start();
  // Poll cursors live in RAM (Neon must sleep): persist them before the host stops the process.
  for (const signal of SHUTDOWN_SIGNALS) process.once(signal, () => void polling.shutdown().finally(() => process.exit(0)));
  if (retrieval) void indexVaultAndEnableRag({ vault, retrieval, ranking, ai, rerankTopN: config.rerank.topN });
  else void vault.repository.refresh().catch(() => undefined);
}
