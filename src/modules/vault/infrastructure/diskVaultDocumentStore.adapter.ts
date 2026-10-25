import * as fs from 'fs';
import * as path from 'path';
import { VaultPathEscapesRootError, type VaultDocumentStore } from '../domain';

/** Raw markdown copies under `VAULT_PATH`. Paths may never escape the root. */
export class DiskVaultDocumentStore implements VaultDocumentStore {
  private readonly rootDir: string;

  constructor(rootDir: string) {
    this.rootDir = path.resolve(rootDir);
  }

  async write(filePath: string, content: string): Promise<void> {
    const target = this.resolveInsideRoot(filePath);
    await fs.promises.mkdir(path.dirname(target), { recursive: true });
    await fs.promises.writeFile(target, content);
  }

  /** Disk copies are optional (ephemeral on Render), so missing files are fine. */
  async remove(filePaths: string[]): Promise<void> {
    for (const filePath of filePaths) await fs.promises.rm(this.resolveInsideRoot(filePath), { force: true });
  }

  private resolveInsideRoot(filePath: string): string {
    const target = path.resolve(this.rootDir, filePath);
    const isInsideRoot = target === this.rootDir || target.startsWith(this.rootDir + path.sep);
    if (!isInsideRoot) throw new VaultPathEscapesRootError(filePath);
    return target;
  }
}
