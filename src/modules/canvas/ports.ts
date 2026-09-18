import type { CanvasFile, CanvasFolder } from './dto';

/**
 * `modules/canvas` port — the capability other modules (`files`, `conversations`)
 * need from Canvas without importing `CanvasClient` directly (mục 3.1: "modules/files
 * ports.ts có thể khai báo ICanvasFileClient nếu muốn mock trong test thay vì import
 * trực tiếp class từ modules/canvas"). Describes `CanvasClient`'s current public
 * surface (Phase 1); `CanvasClient` itself still lives in `src/canvas/canvasClient.ts`
 * until the `files`/`conversations` module split in a later phase.
 */
export interface ICanvasFileClient {
  findFolderByPath(path: string): Promise<CanvasFolder | null>;
  listSubfolders(folderId: number): Promise<CanvasFolder[]>;
  createFolder(parentFolderId: number, name: string): Promise<CanvasFolder>;
  listFilesInFolder(folderId: number, since?: Date): Promise<CanvasFile[]>;
  listAllFilesInFolder(folderId: number): Promise<CanvasFile[]>;
  downloadFile(fileUrl: string): Promise<Buffer>;
  uploadFileToFolder(folderId: number, fileName: string, content: Buffer, mimeType: string): Promise<void>;
}
