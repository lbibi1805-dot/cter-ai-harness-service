import type { CanvasAccountConfig } from '../../../../shared/canvas/interfaces/canvasAccount.interface';
import { type Sleep } from '../../../../shared/resilience';
import { type CanvasFile, type CanvasFilesGateway, type ContentExtractor, type ParsedFileName, type ResultRenderer } from '../../domain';

export interface FileQaJobDeps {
  createClient: (account: CanvasAccountConfig) => CanvasFilesGateway;
  extract: ContentExtractor;
  renderer: ResultRenderer;
  sleep?: Sleep;
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
