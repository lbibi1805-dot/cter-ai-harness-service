import { loadConfig } from './config';
import { StateManager } from './state/stateManager';
import { PollOrchestrator } from './orchestrator/pollOrchestrator';
import { EmailNotifier } from './utils/emailNotifier';
import { logger } from './utils/logger';
import { ApiServer } from './api/server';
import { KnowledgeIndexer, RAGRetriever, CitationPromptBuilder, createEmbeddingService } from './rag';

async function main(): Promise<void> {
  const config = loadConfig();
  const state = new StateManager();
  state.load();

  const emailNotifier = new EmailNotifier(config.gmail.user, config.gmail.appPassword);

  let ragRetriever: RAGRetriever | undefined;
  let citationBuilder: CitationPromptBuilder | undefined;

  if (config.vaultConfig) {
    const embedder = createEmbeddingService(
      config.vaultConfig.embeddingProvider,
      { gemini: config.aiKeys.gemini, openai: config.aiKeys.openai },
    );

    try {
      const indexer = new KnowledgeIndexer(config.vaultConfig, embedder);
      await indexer.indexAll();
      logger.info('Document vault indexed — RAG ready');

      ragRetriever = new RAGRetriever(config.vaultConfig, embedder);
      citationBuilder = new CitationPromptBuilder();
    } catch (err) {
      logger.info(`Vault indexing skipped or failed — falling back to knowledge.md: ${(err as Error).message}`);
    }
  }

  const orchestrator = new PollOrchestrator(
    config, state, emailNotifier,
    ragRetriever, citationBuilder,
  );

  const apiPort = parseInt(process.env.API_PORT ?? '3000', 10);
  const apiServer = new ApiServer(
    () => orchestrator.pollAllAccounts(),
    config,
    emailNotifier,
    apiPort,
  );

  logger.startup(config.accounts.length, config.pollIntervalMs);
  apiServer.start();
}

main().catch(err => {
  logger.info(`FATAL: ${(err as Error).message}`);
  process.exit(1);
});
