import { CanvasClient } from '../canvas/canvasClient';
import { extractContent } from '../extractor/fileExtractor';
import { StateManager } from '../state/stateManager';
import type { AIProviderName, AppConfig, CanvasAccountConfig, CanvasFile, ParsedFileName } from '../types';
import { createAIAdapter, resolveModel } from '../ai/aiRouter';
import { ALLOWED_MODELS, getModelApiMode, isValidModel } from '../config/allowedModels';
import { parseFileName } from '../utils/fileParser';
import { buildErrorPdf, buildInvalidModelPdf, buildSuccessPdf, PDF_MIME } from '../utils/resultBuilder';
import { logger } from '../utils/logger';
import { withTimeout } from '../utils/withTimeout';
import { injectKnowledge } from '../utils/injectKnowledge';
import { EmailNotifier } from '../utils/emailNotifier';
import { CitationPromptBuilder } from '../rag/citationPromptBuilder';
import type { RAGRetriever } from '../rag/ragRetriever';
import type { ConversationPoller } from './conversationPoller';

export class PollOrchestrator {
  private pollCount = 0;
  private lastPollTime: Date | undefined = undefined;

  constructor(
    private config: AppConfig,
    private state: StateManager,
    private emailNotifier: EmailNotifier,
    private ragRetriever?: RAGRetriever,
    private citationBuilder?: CitationPromptBuilder,
    private conversationPoller?: ConversationPoller,
  ) {}

  async pollAllAccounts(): Promise<void> {
    this.pollCount += 1;
    logger.interval(this.pollCount);

    const staleThresholdMs = this.config.aiTimeoutMs * (this.config.maxRetryCount + 2);
    const stale = this.state.resetStaleProcessing(staleThresholdMs);
    for (const r of stale) logger.staleReset(r.fileName, r.updatedAt);

    const pollStartTime = new Date();
    for (const account of this.config.accounts) {
      await this.pollAccount(account);
    }
    this.lastPollTime = pollStartTime;
  }

  private async pollAccount(account: CanvasAccountConfig): Promise<void> {
    const client = new CanvasClient(account.url, account.apiKey);
    logger.fetch(account.index, account.url);

    try {
      await this.pollAccountInner(account, client);
    } catch (err) {
      logger.fetchError(account.index, (err as Error).message);
    }

    // Extension chat (Conversations API) — isolated try/catch so a conversation
    // failure never affects the file flow above, and a file-flow early-return
    // never skips the conversation poll.
    if (this.conversationPoller) {
      try {
        await this.conversationPoller.pollAccountConversations(account);
      } catch (err) {
        logger.info(`[conv] account #${account.index} failed: ${(err as Error).message} — file flow unaffected`);
      }
    }
  }

  private async pollAccountInner(account: CanvasAccountConfig, client: CanvasClient): Promise<void> {
    const { materials: MATERIALS_FOLDER, input: INPUT_FOLDER, output: OUTPUT_FOLDER } = this.config.canvasFolder;

    // 1. Find Materials folder — skip account if missing
    const materialsFolder = await client.findFolderByPath(MATERIALS_FOLDER);
    if (!materialsFolder) {
      logger.folderSkip(account.index, `"${MATERIALS_FOLDER}" folder not found`);
      return;
    }
    logger.folderFound(MATERIALS_FOLDER, materialsFolder.id);

    // 2. List subfolders to find Q (input) and A (output)
    const subfolders = await client.listSubfolders(materialsFolder.id);
    const qFolder = subfolders.find((f) => f.name === INPUT_FOLDER);
    if (!qFolder) {
      logger.folderSkip(account.index, `"${INPUT_FOLDER}" subfolder not found inside ${MATERIALS_FOLDER}`);
      return;
    }
    logger.folderFound(INPUT_FOLDER, qFolder.id);

    let aFolder = subfolders.find((f) => f.name === OUTPUT_FOLDER);
    if (!aFolder) {
      aFolder = await client.createFolder(materialsFolder.id, OUTPUT_FOLDER);
      logger.folderCreated(OUTPUT_FOLDER, aFolder.id);
    } else {
      logger.folderFound(OUTPUT_FOLDER, aFolder.id);
    }

    // 3. List files in Q (input) and A (output, for dedup check)
    const [inputFiles, outputFiles] = await Promise.all([
      client.listFilesInFolder(qFolder.id, this.lastPollTime),
      client.listAllFilesInFolder(aFolder.id),
    ]);

    logger.fetchDone(account.index, inputFiles.length);
    const outputFileNames = new Set(outputFiles.map((f) => f.display_name));

    // 4. Process each input file
    for (const file of inputFiles) {
      const parsed = parseFileName(file.display_name);
      if (!parsed) {
        logger.skip(file.display_name, 'invalid-name');
        continue;
      }

      if (outputFileNames.has(parsed.doneFileName)) {
        logger.skip(file.display_name, 'done-on-canvas');
        continue;
      }
      if (this.state.isProcessed(String(file.id), file.display_name)) {
        logger.skip(file.display_name, 'in-state');
        continue;
      }

      logger.check(file.display_name);
      await this.processFile(file, parsed, account, client, aFolder.id);
      outputFileNames.add(parsed.doneFileName);
    }
  }

  private async processFile(
    file: CanvasFile,
    parsed: ParsedFileName,
    account: CanvasAccountConfig,
    client: CanvasClient,
    outputFolderId: number,
  ): Promise<void> {
    const fileIdStr = String(file.id);
    const primaryModel = resolveModel(parsed.provider, parsed.model, this.config.defaultModels);

    // Validate model when explicitly specified in filename
    if (parsed.model !== undefined && !isValidModel(parsed.provider, primaryModel)) {
      logger.validateFail(file.display_name, parsed.provider, primaryModel, ALLOWED_MODELS[parsed.provider]);
      const resultBuffer = await buildInvalidModelPdf(file.display_name, parsed.provider, primaryModel, ALLOWED_MODELS[parsed.provider]);
      await client.uploadFileToFolder(outputFolderId, parsed.doneFileName, resultBuffer, PDF_MIME)
        .catch((err: Error) => logger.uploadErrorFailed(parsed.doneFileName, err.message));
      this.state.setStatus({
        fileId: fileIdStr,
        fileName: file.display_name,
        accountIndex: account.index,
        status: 'failed',
        retryCount: 0,
        updatedAt: new Date().toISOString(),
        error: `Invalid model: ${primaryModel}`,
      });
      logger.invalidModel(file.display_name, parsed.provider, primaryModel);
      if (account.email) {
        this.emailNotifier.notifyError(account.email, file.display_name, parsed.provider, primaryModel, `Invalid model "${primaryModel}". Allowed: ${ALLOWED_MODELS[parsed.provider].join(', ')}`);
      }
      return;
    }

    // Build model priority chain: filename-specified or default first, then fallback list
    const modelChain = this.buildModelChain(parsed.provider, primaryModel);
    logger.validateOk(file.display_name, parsed.provider, modelChain[0]);
    this.state.setStatus({
      fileId: fileIdStr,
      fileName: file.display_name,
      accountIndex: account.index,
      status: 'processing',
      retryCount: 0,
      updatedAt: new Date().toISOString(),
    });

    let lastError: Error | undefined;
    let currentModel = modelChain[0];
    let totalAttempts = 0;

    for (let mi = 0; mi < modelChain.length; mi++) {
      currentModel = modelChain[mi];

      for (let attempt = 0; attempt <= this.config.maxRetryCount; attempt++) {
        totalAttempts++;
        try {
          logger.download(file.display_name);
          const buffer = await client.downloadFile(file.url);

          logger.extract(file.display_name, parsed.extension);
          const content = await extractContent(buffer, parsed.extension);

          logger.ai(parsed.provider, currentModel, file.display_name);
          const adapter = createAIAdapter(parsed.provider, this.config.aiKeys, this.config.grokBaseUrl);

          const { systemPrompt: finalSystemPrompt, fileContent: finalContent } = await this.preparePrompt(content);

          const rawResponse = await withTimeout(
            adapter.process(finalContent, finalSystemPrompt, currentModel),
            this.config.aiTimeoutMs,
            `${parsed.provider}/${currentModel}`
          );

          const aiResponse = this.citationBuilder
            ? CitationPromptBuilder.cleanResponse(rawResponse)
            : rawResponse;

          const resultBuffer = await buildSuccessPdf(file.display_name, parsed.provider, currentModel, aiResponse);
          logger.upload(parsed.doneFileName);
          await client.uploadFileToFolder(outputFolderId, parsed.doneFileName, resultBuffer, PDF_MIME);

          this.state.setStatus({
            fileId: fileIdStr,
            fileName: file.display_name,
            accountIndex: account.index,
            status: 'done',
            retryCount: totalAttempts - 1,
            updatedAt: new Date().toISOString(),
          });
          logger.ok(file.display_name, parsed.doneFileName);
          if (account.email) {
            this.emailNotifier.notifySuccess(account.email, file.display_name, parsed.doneFileName, parsed.provider, currentModel);
          }
          return;
        } catch (err) {
          lastError = err as Error;
          const isLastAttemptOnLastModel = mi === modelChain.length - 1 && attempt >= this.config.maxRetryCount;
          if (isLastAttemptOnLastModel) {
            // Will exit loop and fail
          } else if (attempt >= this.config.maxRetryCount && mi < modelChain.length - 1) {
            logger.fallback(parsed.provider, currentModel, modelChain[mi + 1], file.display_name, lastError.message);
          } else {
            logger.retry(attempt + 1, this.config.maxRetryCount + 1, file.display_name, lastError.message);
          }
        }
      }
    }

    const errorBuffer = await buildErrorPdf(file.display_name, parsed.provider, currentModel, lastError!);
    logger.upload(parsed.doneFileName);
    await client.uploadFileToFolder(outputFolderId, parsed.doneFileName, errorBuffer, PDF_MIME)
      .catch((err: Error) => logger.uploadErrorFailed(parsed.doneFileName, err.message));

    this.state.setStatus({
      fileId: fileIdStr,
      fileName: file.display_name,
      accountIndex: account.index,
      status: 'failed',
      retryCount: totalAttempts - 1,
      updatedAt: new Date().toISOString(),
      error: lastError?.message,
    });
    logger.failed(file.display_name, lastError?.message ?? 'unknown error');
    if (account.email) {
      await this.emailNotifier.notifyError(account.email, file.display_name, parsed.provider, currentModel, lastError?.message ?? 'unknown error');
    }
  }

  private buildModelChain(provider: AIProviderName, primaryModel: string): string[] {
    const fallbackList = this.config.modelFallback[provider];
    const chain: string[] = [primaryModel];
    const primaryMode = getModelApiMode(provider, primaryModel);
    for (const fb of fallbackList) {
      if (fb !== primaryModel && !chain.includes(fb)
        && (provider !== 'openai' || getModelApiMode(provider, fb) === primaryMode)) {
        chain.push(fb);
      }
    }
    return chain;
  }

  private async preparePrompt(content: import('../types').FileContent): Promise<{ systemPrompt: string; fileContent: import('../types').FileContent }> {
    if (this.ragRetriever && this.citationBuilder && content.textContent.trim()) {
      try {
        const chunks = await this.ragRetriever.retrieve(content.textContent);
        const result = this.citationBuilder.build(
          this.config.systemPrompt,
          chunks,
          content.textContent,
        );
        return {
          systemPrompt: result.systemPrompt,
          fileContent: { ...content, textContent: result.userContent },
        };
      } catch (err) {
        logger.info(`RAG retrieval failed — falling back to knowledge.md: ${(err as Error).message}`);
      }
    }

    return {
      systemPrompt: this.config.systemPrompt,
      fileContent: injectKnowledge(content, this.config.knowledgeContent),
    };
  }
}
