/** Raw markdown copies of vault files (local disk). Best-effort, never authoritative. */
export interface VaultDocumentStore {
  write(filePath: string, content: string): Promise<void>;
  remove(filePaths: string[]): Promise<void>;
}
