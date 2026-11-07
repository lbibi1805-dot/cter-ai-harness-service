import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { MARKDOWN_CONTENT_TYPE, VaultEntryStatus, VaultSourceType, depthOf, folderPathOf, type VaultEntry } from '../domain';
import { MANIFEST_FILE_NAME } from './constants/fileVault.constants';
import { resolveManifestPath } from './helpers/fileVault.helper';
import { InMemoryVaultRepository } from './inMemoryVault.repository';
import type { ManifestFile, StoredEntry } from './interfaces/fileVault.interface';

/**
 * Vault manifest kept in a local JSON file — the dev fallback when Neon is not
 * configured. Prefers `data/.vault-manifest.json` and mirrors writes to the
 * repo-root copy so older deployments keep reading the same data. Legacy
 * entries (content inline, no object key) load as "needs re-upload".
 */
export class FileVaultRepository extends InMemoryVaultRepository {
  private readonly manifestPath: string;
  private readonly mirrorPath: string;

  constructor(rootDir: string = process.cwd()) {
    super();
    this.mirrorPath = path.resolve(rootDir, MANIFEST_FILE_NAME);
    this.manifestPath = resolveManifestPath(rootDir, this.mirrorPath);
    this.replaceAll(this.load());
  }

  protected override changed(): void {
    const files: Record<string, StoredEntry> = {};
    for (const entry of this.files.values()) {
      const { filePath, folderPath: _folder, depth: _depth, ...stored } = entry;
      files[filePath] = stored;
    }
    const payload = JSON.stringify({ files }, null, 2);
    for (const target of new Set([this.manifestPath, this.mirrorPath])) {
      try {
        fs.writeFileSync(target, payload);
      } catch {
        // Best-effort mirror; the primary manifest is what gets read back.
      }
    }
  }

  private load(): VaultEntry[] {
    let raw: ManifestFile;
    try {
      raw = JSON.parse(fs.readFileSync(this.manifestPath, 'utf-8')) as ManifestFile;
    } catch {
      return [];
    }
    return Object.entries(raw.files ?? {}).map(([filePath, stored]) => ({
      filePath,
      docId: stored.docId ?? crypto.randomUUID(),
      hash: stored.hash ?? '',
      objectKey: stored.objectKey ?? '',
      chunkIds: stored.chunkIds ?? [],
      indexed: !!stored.indexed,
      indexedHash: stored.indexedHash ?? null,
      status: stored.status ?? VaultEntryStatus.ACTIVE,
      sourceType: stored.sourceType ?? VaultSourceType.MARKDOWN,
      contentType: stored.contentType ?? MARKDOWN_CONTENT_TYPE,
      sizeBytes: stored.sizeBytes ?? null,
      lastError: stored.lastError ?? null,
      updatedAt: stored.updatedAt ?? new Date().toISOString(),
      folderPath: folderPathOf(filePath),
      depth: depthOf(filePath),
    }));
  }
}
