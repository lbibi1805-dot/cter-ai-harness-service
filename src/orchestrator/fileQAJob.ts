import { CanvasClient } from '../canvas/canvasClient';
import { resolveModel } from '../ai/aiRouter';
import { ALLOWED_MODELS, isValidModel } from '../config/allowedModels';
import { extractContent } from '../extractor/fileExtractor';
import { AIInvocationError, type AIInvocationService } from '../modules/ai';
import { KEEP_CURSOR, PollJobName, advanceWatermark, type PollJob, type PollJobContext, type PollJobResult, type PolledItem } from '../modules/polling/domain';
import { errorMessage, retryTransient, type Sleep } from '../shared/resilience';
import type { StateManager } from '../state/stateManager';
import type { AppConfig, CanvasAccountConfig, CanvasFile, FileContent, ParsedFileName } from '../types';
import type { EmailNotifier } from '../utils/emailNotifier';
import { parseFileName } from '../utils/fileParser';
import { logger } from '../utils/logger';
import { PDF_MIME, buildErrorPdf, buildInvalidModelPdf, buildSuccessPdf } from '../utils/resultBuilder';

/** Canvas I/O and PDF rendering get a few quick retries; AI has its own policy. */
export const IO_ATTEMPTS = 3;
export const RENDER_ATTEMPTS = 2;

export enum FileOutcome {
  DONE = 'done',
  FAILED = 'failed',
  SKIPPED = 'skipped',
  /** Not finished (still processing, or result could not be delivered) — retried later. */
  DEFERRED = 'deferred',
}

export type CanvasFilesClient = Pick<
  CanvasClient,
  'findFolderByPath' | 'listSubfolders' | 'createFolder' | 'listFilesInFolder' | 'listAllFilesInFolder' | 'downloadFile' | 'uploadFileToFolder'
>;

export interface ResultRenderer {
  success(originalName: string, provider: string, model: string, answer: string): Promise<Buffer>;
  error(originalName: string, provider: string, model: string, error: Error): Promise<Buffer>;
  invalidModel(originalName: string, provider: string, model: string, allowed: string[]): Promise<Buffer>;
}

export interface FileQAJobDeps {
  createClient?: (account: CanvasAccountConfig) => CanvasFilesClient;
  extract?: (buffer: Buffer, extension: string) => Promise<FileContent>;
  renderer?: ResultRenderer;
  sleep?: Sleep;
}

const PDF_RENDERER: ResultRenderer = {
  success: buildSuccessPdf,
  error: buildErrorPdf,
  invalidModel: buildInvalidModelPdf,
};

interface OutputFolder {
  client: CanvasFilesClient;
  folderId: number;
  existingNames: Set<string>;
}

/**
 * Materials/Q → AI → Materials/A. Files are handled oldest-first; a failure on
 * one file never stops the others, and the cursor only advances past files
 * that reached a terminal outcome.
 */
export class FileQAJob implements PollJob {
  readonly name = PollJobName.FILE_QA;
  private readonly createClient: (account: CanvasAccountConfig) => CanvasFilesClient;
  private readonly extract: (buffer: Buffer, extension: string) => Promise<FileContent>;
  private readonly renderer: ResultRenderer;
  private readonly sleep?: Sleep;

  constructor(
    private readonly config: AppConfig,
    private readonly state: StateManager,
    private readonly notifier: EmailNotifier,
    private readonly ai: AIInvocationService,
    deps: FileQAJobDeps = {},
  ) {
    this.createClient = deps.createClient ?? ((account) => new CanvasClient(account.url, account.apiKey));
    this.extract = deps.extract ?? extractContent;
    this.renderer = deps.renderer ?? PDF_RENDERER;
    this.sleep = deps.sleep;
  }

  async run(account: CanvasAccountConfig, { cursor }: PollJobContext): Promise<PollJobResult> {
    const client = this.createClient(account);
    logger.fetch(account.index, account.url);

    const output = await this.resolveFolders(client, account);
    if (!output) return KEEP_CURSOR;

    const [inputFiles, outputFiles] = await Promise.all([
      client.listFilesInFolder(output.inputFolderId, cursor ?? undefined),
      client.listAllFilesInFolder(output.folderId),
    ]);
    logger.fetchDone(account.index, inputFiles.length);

    const target: OutputFolder = { client, folderId: output.folderId, existingNames: new Set(outputFiles.map((f) => f.display_name)) };
    const polled: PolledItem[] = [];
    for (const file of [...inputFiles].sort(byUpdatedAtAsc)) {
      const outcome = await this.handleFile(file, account, target).catch((err) => {
        logger.info(`[file-qa] ${file.display_name} deferred: ${errorMessage(err)}`);
        return FileOutcome.DEFERRED;
      });
      polled.push({ updatedAt: new Date(file.updated_at), settled: outcome !== FileOutcome.DEFERRED });
    }
    return { nextCursor: advanceWatermark(polled, cursor) };
  }

  private async resolveFolders(client: CanvasFilesClient, account: CanvasAccountConfig): Promise<{ inputFolderId: number; folderId: number } | null> {
    const { materials, input, output } = this.config.canvasFolder;
    const materialsFolder = await client.findFolderByPath(materials);
    if (!materialsFolder) {
      logger.folderSkip(account.index, `"${materials}" folder not found`);
      return null;
    }
    const subfolders = await client.listSubfolders(materialsFolder.id);
    const inputFolder = subfolders.find((f) => f.name === input);
    if (!inputFolder) {
      logger.folderSkip(account.index, `"${input}" subfolder not found inside ${materials}`);
      return null;
    }
    let outputFolder = subfolders.find((f) => f.name === output);
    if (!outputFolder) {
      outputFolder = await client.createFolder(materialsFolder.id, output);
      logger.folderCreated(output, outputFolder.id);
    }
    return { inputFolderId: inputFolder.id, folderId: outputFolder.id };
  }

  private async handleFile(file: CanvasFile, account: CanvasAccountConfig, target: OutputFolder): Promise<FileOutcome> {
    const parsed = parseFileName(file.display_name);
    if (!parsed) {
      logger.skip(file.display_name, 'invalid-name');
      return FileOutcome.SKIPPED;
    }
    if (target.existingNames.has(parsed.doneFileName)) {
      logger.skip(file.display_name, 'done-on-canvas');
      return FileOutcome.SKIPPED;
    }
    if (this.state.isProcessed(String(file.id), file.display_name)) {
      logger.skip(file.display_name, 'in-state');
      return this.state.getStatus(String(file.id)) === 'processing' ? FileOutcome.DEFERRED : FileOutcome.SKIPPED;
    }

    logger.check(file.display_name);
    const outcome = await this.processFile(file, parsed, account, target);
    if (outcome === FileOutcome.DONE || outcome === FileOutcome.FAILED) target.existingNames.add(parsed.doneFileName);
    return outcome;
  }

  private async processFile(file: CanvasFile, parsed: ParsedFileName, account: CanvasAccountConfig, target: OutputFolder): Promise<FileOutcome> {
    const model = resolveModel(parsed.provider, parsed.model, this.config.defaultModels);
    if (parsed.model !== undefined && !isValidModel(parsed.provider, model)) {
      return this.rejectInvalidModel(file, parsed, model, account, target);
    }

    logger.validateOk(file.display_name, parsed.provider, model);
    this.record(file, account, 'processing', 0);

    let content: FileContent;
    try {
      content = await this.io(async () => {
        logger.download(file.display_name);
        const buffer = await target.client.downloadFile(file.url);
        logger.extract(file.display_name, parsed.extension);
        return this.extract(buffer, parsed.extension);
      });
    } catch (err) {
      return this.fail(file, parsed, model, err as Error, 0, account, target);
    }

    let answer;
    try {
      answer = await this.ai.answer({ provider: parsed.provider, model, content, label: file.display_name });
    } catch (err) {
      const attempts = err instanceof AIInvocationError ? err.attempts : 0;
      const lastModel = err instanceof AIInvocationError ? err.lastModel : model;
      return this.fail(file, parsed, lastModel, err as Error, attempts, account, target);
    }

    // Past this point the AI answer exists: a render/upload failure defers the
    // file (state stays `processing`) instead of marking it failed.
    const pdf = await retryTransient(() => this.renderer.success(file.display_name, parsed.provider, answer.model, answer.text), { maxAttempts: RENDER_ATTEMPTS, sleep: this.sleep });
    logger.upload(parsed.doneFileName);
    await this.io(() => target.client.uploadFileToFolder(target.folderId, parsed.doneFileName, pdf, PDF_MIME));

    this.record(file, account, 'done', answer.attempts - 1);
    logger.ok(file.display_name, parsed.doneFileName);
    if (account.email) void this.notifier.notifySuccess(account.email, file.display_name, parsed.doneFileName, parsed.provider, answer.model);
    return FileOutcome.DONE;
  }

  private async rejectInvalidModel(file: CanvasFile, parsed: ParsedFileName, model: string, account: CanvasAccountConfig, target: OutputFolder): Promise<FileOutcome> {
    const allowed = ALLOWED_MODELS[parsed.provider];
    logger.validateFail(file.display_name, parsed.provider, model, allowed);
    const pdf = await retryTransient(() => this.renderer.invalidModel(file.display_name, parsed.provider, model, allowed), { maxAttempts: RENDER_ATTEMPTS, sleep: this.sleep });
    await this.io(() => target.client.uploadFileToFolder(target.folderId, parsed.doneFileName, pdf, PDF_MIME));
    this.record(file, account, 'failed', 0, `Invalid model: ${model}`);
    logger.invalidModel(file.display_name, parsed.provider, model);
    if (account.email) void this.notifier.notifyError(account.email, file.display_name, parsed.provider, model, `Invalid model "${model}". Allowed: ${allowed.join(', ')}`);
    return FileOutcome.FAILED;
  }

  /** Delivers an error PDF; if even that cannot be delivered, the file is deferred. */
  private async fail(file: CanvasFile, parsed: ParsedFileName, model: string, error: Error, attempts: number, account: CanvasAccountConfig, target: OutputFolder): Promise<FileOutcome> {
    const pdf = await retryTransient(() => this.renderer.error(file.display_name, parsed.provider, model, error), { maxAttempts: RENDER_ATTEMPTS, sleep: this.sleep });
    logger.upload(parsed.doneFileName);
    await this.io(() => target.client.uploadFileToFolder(target.folderId, parsed.doneFileName, pdf, PDF_MIME));

    this.record(file, account, 'failed', Math.max(0, attempts - 1), error.message);
    logger.failed(file.display_name, error.message);
    if (account.email) void this.notifier.notifyError(account.email, file.display_name, parsed.provider, model, error.message);
    return FileOutcome.FAILED;
  }

  private io<T>(operation: () => Promise<T>): Promise<T> {
    return retryTransient(operation, { maxAttempts: IO_ATTEMPTS, sleep: this.sleep });
  }

  private record(file: CanvasFile, account: CanvasAccountConfig, status: 'processing' | 'done' | 'failed', retryCount: number, error?: string): void {
    this.state.setStatus({
      fileId: String(file.id),
      fileName: file.display_name,
      accountIndex: account.index,
      status,
      retryCount,
      updatedAt: new Date().toISOString(),
      error,
    });
  }
}

function byUpdatedAtAsc(a: CanvasFile, b: CanvasFile): number {
  return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
}
