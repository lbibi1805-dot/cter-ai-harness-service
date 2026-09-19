import type { CanvasFile, CanvasFolder } from '../../types';

export interface ICanvasPort {
  findFolderByPath(path: string): Promise<CanvasFolder | null>;
  listSubfolders(folderId: number): Promise<CanvasFolder[]>;
  createFolder(parentFolderId: number, name: string): Promise<CanvasFolder>;
  listFilesInFolder(folderId: number, since?: Date): Promise<CanvasFile[]>;
  listAllFilesInFolder(folderId: number): Promise<CanvasFile[]>;
  downloadFile(fileUrl: string): Promise<Buffer>;
  uploadFileToFolder(folderId: number, fileName: string, content: Buffer, mimeType: string): Promise<void>;
}
