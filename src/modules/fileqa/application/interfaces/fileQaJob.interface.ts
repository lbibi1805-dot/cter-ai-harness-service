import type { CanvasAccountConfig } from '../../../../shared/canvas/interfaces/canvasAccount.interface';
import { type Sleep } from '../../../../shared/resilience';
import { type CanvasFile, type CanvasFilesGateway, type ContentExtractor, type ParsedFileName, type ResultRenderer } from '../../domain';

export interface FileQaJobDeps {
  createClient: (account: CanvasAccountConfig) => CanvasFilesGateway;
  extract: ContentExtractor;
  renderer: ResultRenderer;
  sleep?: Sleep;
  /** CANVAS_DEADLINE_MS: the AI chain of one file (absent = the invocation default, CHAT_DEADLINE_MS). */
  deadlineMs?: number;
  now?: () => number;
}

/** Where results go for one account during one tick. */
export interface OutputFolder {
  client: CanvasFilesGateway;
  folderId: number;
  existingNames: Set<string>;
}

/** One file being answered. */
export interface FileTask {
  file: CanvasFile;
  parsed: ParsedFileName;
  account: CanvasAccountConfig;
  target: OutputFolder;
}
