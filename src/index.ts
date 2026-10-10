import { loadConfig } from './config';
import { StateManager } from './state/stateManager';
import { FileQAJob } from './orchestrator/fileQAJob';
import { EmailNotifier } from './utils/emailNotifier';
import { logger } from './utils/logger';
import { ApiServer } from './api/server';
import { RAGRetriever, CitationPromptBuilder, createEmbeddingService } from './rag';
import { createVaultModule } from './modules/vault';
import { ConversationPoller } from './orchestrator/conversationPoller';
import { AIInvocationService, PromptPreparer, type RagRefs } from './modules/ai';
import { createPollingModule } from './modules/polling';
import { createAgentModule } from './modules/agent';
import { createRerankModule } from './modules/rerank';
import { validateAllKeys } from './ai/aiRouter';

async function main(): Promise<void> {
  // 1. LOAD THE CONFIGURATIONS
  const config = loadConfig();
  logger.info(`Config loaded — AI keys: gemini=${!!config.aiKeys.gemini} grok=${!!config.aiKeys.grok} openai=${!!config.aiKeys.openai} | vault=${config.vaultConfig ? config.vaultConfig.pineconeIndex : 'none'}`);
  if (!config.aiKeys.openai) logger.info('WARN: OPENAI_API_KEY not set — openai provider will fail');
  if (!config.aiKeys.gemini) logger.info('WARN: GEMINI_API_KEY not set — gemini provider will fail');
  const state = new StateManager();
  state.load();

  const emailNotifier = new EmailNotifier(config.gmail.user, config.gmail.appPassword);

  // Start API truoc de Render detect port ngay, tranh "No open ports detected"
  const apiPort = parseInt(process.env.API_PORT ?? '3000', 10);
  // RAG is filled in after the vault finishes indexing; every flow reads it
  // through this getter, so the update reaches them without re-wiring.
  const ragRefs: RagRefs = {};
  const prompts = new PromptPreparer(config.systemPrompt, config.knowledgeContent, () => ragRefs);
  const ai = new AIInvocationService(config, prompts);
  const vault = createVaultModule(config);
  const ranking = createRerankModule(config.rerank, { pineconeApiKey: config.vaultConfig?.pineconeApiKey });
  // Single-shot by default; `_agent` files / `mode: agent` chats use the agent with fallback.
  const { answers } = createAgentModule(config, { ai, vaultRepository: vault.repository, ranking });

  const fileQAJob = new FileQAJob(config, state, emailNotifier, answers);
  const conversationPoller = new ConversationPoller(config, state, () => ragRefs, undefined, answers);
  const staleThresholdMs = config.aiTimeoutMs * (config.maxRetryCount + 2);
  const polling = createPollingModule(config, {
    jobs: [fileQAJob, conversationPoller],
    validateKeys: () => validateAllKeys(config.aiKeys, config.grokBaseUrl),
    beforeTick: () => {
      for (const record of state.resetStaleProcessing(staleThresholdMs)) logger.staleReset(record.fileName, record.updatedAt);
    },
  });

  const apiServer = new ApiServer(config, emailNotifier, apiPort, vault, polling);
  logger.startup(config.accounts.length, config.pollIntervalMs);
  apiServer.start();

  // Polling is mandatory: start it on boot so a restart/redeploy never leaves
  // it silently stopped. Set POLL_AUTOSTART=false to require GET /start.
  if (config.pollAutostart) polling.scheduler.start();
  else logger.info('POLL_AUTOSTART=false — waiting for GET /start');

  // Cron 12m heartbeat anti-sleep Render (handshake env only) — controllable via /api/cron
  const { startCron } = await import('./utils/cronManager');
  startCron(apiPort);

  if (config.vaultConfig) {
    const embedder = createEmbeddingService(
      config.vaultConfig.embeddingProvider,
      { gemini: config.aiKeys.gemini, openai: config.aiKeys.openai },
    );
    // Chay index background khong block port — Neon-only, không phụ thuộc disk
    (async () => {
      try {
        await vault.indexing.runNow();
        try {
          const { total, indexed } = await vault.service.stats();
          logger.info(`Neon vault stats: ${indexed}/${total} indexed — RAG ready`);
          // Reconcile orphan Pinecone vectors if Neon was cleared via SQL Editor
          if (total === 0) await vault.service.reconcileVectors();
        } catch {
          logger.info('Document vault indexed — RAG ready');
        }
        const vaultTopK = config.vaultConfig!.topK ?? 6;
        const vectorRetriever = new RAGRetriever({ ...config.vaultConfig!, topK: ranking.candidateCount(vaultTopK) }, embedder);
        ragRefs.retriever = ranking.wrap(vectorRetriever, { topN: config.rerank.topN, fallbackTopK: vaultTopK, label: 'single-shot' });
        ragRefs.builder = new CitationPromptBuilder();
      } catch (err) {
        logger.info(`Vault indexing skipped or failed — falling back to knowledge.md: ${(err as Error).message}`);
      }
    })();
  }
}

main().catch(err => {
  logger.info(`FATAL: ${(err as Error).message}`);
  process.exit(1);
});
