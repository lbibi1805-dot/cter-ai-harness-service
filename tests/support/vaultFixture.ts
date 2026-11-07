import * as crypto from 'crypto';
import { InMemoryVaultRepository } from '../../src/modules/vault/infrastructure/inMemoryVault.repository';
import { MARKDOWN_CONTENT_TYPE, VaultEntryStatus, VaultSourceType, computeContentHash, depthOf, folderPathOf, vaultObjectKey, type VaultEntry } from '../../src/modules/vault/domain';

/** A manifest entry for tests (indexed, active). */
export function vaultEntry(filePath: string, overrides: Partial<VaultEntry> = {}): VaultEntry {
  const docId = overrides.docId ?? crypto.randomUUID();
  const hash = overrides.hash ?? 'h';
  return {
    filePath, docId, hash, objectKey: vaultObjectKey(docId, hash), chunkIds: [], indexed: true, indexedHash: hash,
    status: VaultEntryStatus.ACTIVE, sourceType: VaultSourceType.MARKDOWN, contentType: MARKDOWN_CONTENT_TYPE, sizeBytes: 1,
    lastError: null, updatedAt: '', folderPath: folderPathOf(filePath), depth: depthOf(filePath), ...overrides,
  };
}

/**
 * An indexed vault for agent/e2e tests: manifest rows in memory and their
 * content served by `documents.readDocument` (what object storage does in prod).
 */
export async function seedVault(files: Record<string, string>): Promise<{ repository: InMemoryVaultRepository; documents: { readDocument(path: string): Promise<string | null> } }> {
  const repository = new InMemoryVaultRepository();
  for (const [filePath, content] of Object.entries(files)) {
    const docId = crypto.randomUUID();
    const hash = computeContentHash(content);
    await repository.saveVersion({ filePath, docId, hash, objectKey: vaultObjectKey(docId, hash), sourceType: VaultSourceType.MARKDOWN, contentType: MARKDOWN_CONTENT_TYPE, sizeBytes: content.length });
    await repository.commitIndexed({ docId, hash, chunkIds: [] });
  }
  return { repository, documents: { readDocument: async (path) => files[path] ?? null } };
}
