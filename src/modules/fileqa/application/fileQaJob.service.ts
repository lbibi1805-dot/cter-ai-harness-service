import type { CanvasAccountConfig } from '../../../shared/canvas/interfaces/canvasAccount.interface';
import { errorMessage } from '../../../shared/errors';
import { ContentType } from '../../../shared/http/enums/http.enums';
import { logger } from '../../../shared/logging/logger';
import { SkipReason } from '../../../shared/logging/enums/logger.enums';
import { attempt, retryTransient } from '../../../shared/resilience';
import type { StateManager } from '../../../shared/state/processingStateStore';
import { type AnswerResult, type Answerer } from '../../agent/domain';
import { AIInvocationError, type ModelCatalog } from '../../ai';
import type { Notifier } from '../../notification';
import { KEEP_CURSOR, PollJobName, advanceWatermark, type PollJob, type PollJobContext, type PollJobResult, type PolledItem } from '../../polling/domain';
import {
  FileOutcome,
  IO_ATTEMPTS,
  RENDER_ATTEMPTS,
  parseFileName,
  type CanvasFile,
  type CanvasFilesGateway,
  type FileQaFolders,
} from '../domain';
import { FileQaJobDeps, OutputFolder, FileTask } from './interfaces/fileQaJob.interface';
import { byUpdatedAtAsc, describeAnswer } from './helpers/fileQaJob.helper';
import { ProcessingStatus } from '../../../shared/state/enums/processingRecord.enums';

/**
 * Materials/Q → AI → Materials/A. Files are handled oldest-first; a failure on
 * one file never stops the others, and the cursor only advances past files
 * that reached a terminal outcome.
 */
export class FileQAJob implements PollJob {
  readonly name = PollJobName.FILE_QA;

  constructor(
    private readonly folders: FileQaFolders,
    private readonly catalog: ModelCatalog,
    private readonly state: StateManager,
    private readonly notifier: Notifier,
    private readonly answers: Answerer,
    private readonly deps: FileQaJobDeps,
  ) {}

  async run(account: CanvasAccountConfig, { cursor }: PollJobContext): Promise<PollJobResult> {
    const client = this.deps.createClient(account);
    logger.fetch(account.index, account.url);

    const folderIds = await this.resolveFolders(client, account);
    if (!folderIds) return KEEP_CURSOR;

    const [inputFiles, outputFiles] = await Promise.all([
      client.listFilesInFolder(folderIds.inputFolderId, cursor ?? undefined),
      client.listAllFilesInFolder(folderIds.outputFolderId),
    ]);
    logger.fetchDone(account.index, inputFiles.length);

    const target: OutputFolder = { client, folderId: folderIds.outputFolderId, existingNames: new Set(outputFiles.map((f) => f.display_name)) };
    const polled: PolledItem[] = [];
    for (const file of [...inputFiles].sort(byUpdatedAtAsc)) {
      const outcome = await this.handleFileSafely(file, account, target);
      polled.push({ updatedAt: new Date(file.updated_at), settled: outcome !== FileOutcome.DEFERRED });
    }
    return { nextCursor: advanceWatermark(polled, cursor) };
  }

  /** Anything unexpected (Canvas down mid-upload, renderer crash) defers the file to the next tick. */
  private async handleFileSafely(file: CanvasFile, account: CanvasAccountConfig, target: OutputFolder): Promise<FileOutcome> {
    const handled = await attempt(() => this.handleFile(file, account, target));
    if (handled.ok) return handled.value;
    logger.warn(`[file-qa] ${file.display_name} deferred: ${errorMessage(handled.error)}`);
    return FileOutcome.DEFERRED;
  }

  private async resolveFolders(client: CanvasFilesGateway, account: CanvasAccountConfig): Promise<{ inputFolderId: number; outputFolderId: number } | null> {
    const { materials, input, output } = this.folders;
    const materialsFolder = await client.findFolderByPath(materials);
    if (!materialsFolder) {
      logger.folderSkip(account.index, `"${materials}" folder not found`);
      return null;
    }
    const subfolders = await client.listSubfolders(materialsFolder.id);
    const inputFolder = subfolders.find((folder) => folder.name === input);
    if (!inputFolder) {
      logger.folderSkip(account.index, `"${input}" subfolder not found inside ${materials}`);
      return null;
    }
    let outputFolder = subfolders.find((folder) => folder.name === output);
    if (!outputFolder) {
      outputFolder = await client.createFolder(materialsFolder.id, output);
      logger.folderCreated(output, outputFolder.id);
    }
    return { inputFolderId: inputFolder.id, outputFolderId: outputFolder.id };
  }

  private async handleFile(file: CanvasFile, account: CanvasAccountConfig, target: OutputFolder): Promise<FileOutcome> {
    const parsed = parseFileName(file.display_name);
    if (!parsed) {
      logger.skip(file.display_name, SkipReason.INVALID_NAME);
      return FileOutcome.SKIPPED;
    }
    if (target.existingNames.has(parsed.doneFileName)) {
      logger.skip(file.display_name, SkipReason.DONE_ON_CANVAS);
      return FileOutcome.SKIPPED;
    }
    if (this.state.isProcessed(String(file.id), file.display_name)) {
      logger.skip(file.display_name, SkipReason.IN_STATE);
      return this.state.getStatus(String(file.id)) === ProcessingStatus.PROCESSING ? FileOutcome.DEFERRED : FileOutcome.SKIPPED;
    }

    logger.check(file.display_name);
    const outcome = await this.processFile({ file, parsed, account, target });
    if (outcome === FileOutcome.DONE || outcome === FileOutcome.FAILED) target.existingNames.add(parsed.doneFileName);
    return outcome;
  }

  private async processFile(task: FileTask): Promise<FileOutcome> {
    const { file, parsed } = task;
    const model = this.catalog.resolve(parsed.provider, parsed.model);
    if (parsed.model !== undefined && !this.catalog.isAllowed(parsed.provider, model)) return this.rejectInvalidModel(task, model);

    logger.validateOk(file.display_name, parsed.provider, model);
    this.record(task, ProcessingStatus.PROCESSING, 0);

    const content = await attempt(() => this.io(async () => {
      logger.download(file.display_name);
      const buffer = await task.target.client.downloadFile(file.url);
      logger.extract(file.display_name, parsed.extension);
      return this.deps.extract(buffer, parsed.extension);
    }));
    if (!content.ok) return this.fail(task, model, content.error, 0);

    const answer = await attempt(() => this.answers.answer({ provider: parsed.provider, model, content: content.value, label: file.display_name, mode: parsed.mode }));
    if (!answer.ok) {
      const failure = answer.error;
      const isInvocationError = failure instanceof AIInvocationError;
      return this.fail(task, isInvocationError ? failure.lastModel : model, failure, isInvocationError ? failure.attempts : 0);
    }
    return this.deliverAnswer(task, answer.value);
  }

  /** The AI answer exists: a render/upload failure here defers the file (state stays PROCESSING). */
  private async deliverAnswer(task: FileTask, answer: AnswerResult): Promise<FileOutcome> {
    const { file, parsed, account } = task;
    const pdf = await this.render(() => this.deps.renderer.success(file.display_name, parsed.provider, answer.model, answer.text, describeAnswer(answer)));
    await this.upload(task, pdf);

    this.record(task, ProcessingStatus.DONE, answer.attempts - 1);
    logger.ok(file.display_name, parsed.doneFileName);
    if (account.email) void this.notifier.notifySuccess(account.email, file.display_name, parsed.doneFileName, parsed.provider, answer.model);
    return FileOutcome.DONE;
  }

  private async rejectInvalidModel(task: FileTask, model: string): Promise<FileOutcome> {
    const { file, parsed, account } = task;
    const allowed = this.catalog.allowedModels(parsed.provider);
    logger.validateFail(file.display_name, parsed.provider, model, allowed);
    const pdf = await this.render(() => this.deps.renderer.invalidModel(file.display_name, parsed.provider, model, allowed));
    await this.upload(task, pdf);

    this.record(task, ProcessingStatus.FAILED, 0, `Invalid model: ${model}`);
    logger.invalidModel(file.display_name, parsed.provider, model);
    if (account.email) void this.notifier.notifyError(account.email, file.display_name, parsed.provider, model, `Invalid model "${model}". Allowed: ${allowed.join(', ')}`);
    return FileOutcome.FAILED;
  }

  /** Delivers an error PDF; if even that cannot be delivered, the file is deferred. */
  private async fail(task: FileTask, model: string, failure: unknown, attempts: number): Promise<FileOutcome> {
    const { file, parsed, account } = task;
    const error = failure instanceof Error ? failure : new Error(errorMessage(failure));
    const pdf = await this.render(() => this.deps.renderer.error(file.display_name, parsed.provider, model, error));
    await this.upload(task, pdf);

    this.record(task, ProcessingStatus.FAILED, Math.max(0, attempts - 1), error.message);
    logger.failed(file.display_name, error.message);
    if (account.email) void this.notifier.notifyError(account.email, file.display_name, parsed.provider, model, error.message);
    return FileOutcome.FAILED;
  }

  private async upload({ parsed, target }: FileTask, pdf: Buffer): Promise<void> {
    logger.upload(parsed.doneFileName);
    await this.io(() => target.client.uploadFileToFolder(target.folderId, parsed.doneFileName, pdf, ContentType.PDF));
  }

  private render(operation: () => Promise<Buffer>): Promise<Buffer> {
    return retryTransient(operation, { maxAttempts: RENDER_ATTEMPTS, sleep: this.deps.sleep });
  }

  private io<T>(operation: () => Promise<T>): Promise<T> {
    return retryTransient(operation, { maxAttempts: IO_ATTEMPTS, sleep: this.deps.sleep });
  }

  private record({ file, account }: FileTask, status: ProcessingStatus, retryCount: number, error?: string): void {
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
