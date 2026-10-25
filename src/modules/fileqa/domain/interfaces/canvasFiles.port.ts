export interface CanvasFolder {
  id: number;
  name: string;
  full_name: string;
  parent_folder_id: number | null;
}

export interface CanvasFile {
  id: number;
  display_name: string;
  url: string;
  size: number;
  updated_at: string;
}

/** The slice of the Canvas Files API the job needs (one instance per account). */
export interface CanvasFilesGateway {
  /** The folder at `path` under My Files, or null when it does not exist. */
  findFolderByPath(path: string): Promise<CanvasFolder | null>;
  listSubfolders(folderId: number): Promise<CanvasFolder[]>;
  createFolder(parentFolderId: number, name: string): Promise<CanvasFolder>;
  /** `START_*` files, newest first, stopping at files older than `since`. */
  listFilesInFolder(folderId: number, since?: Date): Promise<CanvasFile[]>;
  listAllFilesInFolder(folderId: number): Promise<CanvasFile[]>;
  downloadFile(fileUrl: string): Promise<Buffer>;
  uploadFileToFolder(folderId: number, fileName: string, content: Buffer, mimeType: string): Promise<void>;
}
