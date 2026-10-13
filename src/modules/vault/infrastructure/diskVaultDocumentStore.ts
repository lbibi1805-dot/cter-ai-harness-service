import * as fs from 'fs';
import * as path from 'path';
import type { VaultDocumentStore } from '../domain';

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

  async remove(filePaths: string[]): Promise<void> {
    for (const filePath of filePaths) {
      try {
        await fs.promises.unlink(this.resolveInsideRoot(filePath));
      } catch {
        // Disk copies are optional (ephemeral on Render); missing files are fine.
      }
    }
  }

  private resolveInsideRoot(filePath: string): string {
    const target = path.resolve(this.rootDir, filePath);
    if (target !== this.rootDir && !target.startsWith(this.rootDir + path.sep)) {
      throw new Error(`Vault path escapes root: ${filePath}`);
    }
    return target;
  }
}
