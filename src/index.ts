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

  // Start API truoc de Render detect port ngay, tranh "No open ports detected"
  const apiPort = parseInt(process.env.API_PORT ?? '3000', 10);
  // Tam khoi tao orchestrator chua RAG, se cap nhat sau khi index xong
  let ragRetriever: RAGRetriever | undefined;
  let citationBuilder: CitationPromptBuilder | undefined;
  let orchestrator = new PollOrchestrator(config, state, emailNotifier, ragRetriever, citationBuilder);
  const apiServer = new ApiServer(() => orchestrator.pollAllAccounts(), config, emailNotifier, apiPort);
  logger.startup(config.accounts.length, config.pollIntervalMs);
  apiServer.start();

  if (config.vaultConfig) {
    const embedder = createEmbeddingService(
      config.vaultConfig.embeddingProvider,
      { gemini: config.aiKeys.gemini, openai: config.aiKeys.openai },
    );
    // Chay index background khong block port
    (async () => {
      try {
        const indexer = new KnowledgeIndexer(config.vaultConfig!, embedder);
        await indexer.indexAll();
        logger.info('Document vault indexed — RAG ready');
        ragRetriever = new RAGRetriever(config.vaultConfig!, embedder);
        citationBuilder = new CitationPromptBuilder();
        // Cap nhat orchestrator de cac poll tiep theo dung RAG
        (orchestrator as any).ragRetriever = ragRetriever;
        (orchestrator as any).citationBuilder = citationBuilder;
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
