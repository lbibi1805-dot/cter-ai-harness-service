import type { StateManager } from '../../shared/state/processingStateStore';
import type { Answerer } from '../agent/domain';
import type { ModelCatalog } from '../ai';
import type { Notifier } from '../notification';
import { FileQAJob } from './application/fileQaJob.service';
import type { FileQaFolders } from './domain';
import { CanvasFilesClient } from './infrastructure/canvasFilesClient.adapter';
import { extractContent } from './infrastructure/pdfjsFileExtractor.adapter';
import { PDF_RESULT_RENDERER } from './infrastructure/pdfResultRenderer.adapter';
import { FileQaJobDeps } from './application/interfaces/fileQaJob.interface';

export interface FileQaModuleDeps {
  catalog: ModelCatalog;
  state: StateManager;
  notifier: Notifier;
  answers: Answerer;
  /** Test hooks: fake Canvas, extractor or renderer. */
  overrides?: Partial<FileQaJobDeps>;
}

/** The Canvas file Q&A poll job (Materials/Q → Materials/A) with production adapters. */
export function createFileQaJob(folders: FileQaFolders, deps: FileQaModuleDeps): FileQAJob {
  const jobDeps: FileQaJobDeps = {
    createClient: (account) => new CanvasFilesClient(account.url, account.apiKey),
    extract: extractContent,
    renderer: PDF_RESULT_RENDERER,
    ...deps.overrides,
  };
  return new FileQAJob(folders, deps.catalog, deps.state, deps.notifier, deps.answers, jobDeps);
}

export { FileQAJob } from './application/fileQaJob.service';
export * from './domain';
export { CanvasFilesClient } from './infrastructure/canvasFilesClient.adapter';
export { extractContent } from './infrastructure/pdfjsFileExtractor.adapter';
export { buildErrorPdf, buildInvalidModelPdf, buildSuccessPdf, PDF_RESULT_RENDERER } from './infrastructure/pdfResultRenderer.adapter';
export { describeAnswer } from './application/helpers/fileQaJob.helper';
export type { FileQaJobDeps } from './application/interfaces/fileQaJob.interface';
