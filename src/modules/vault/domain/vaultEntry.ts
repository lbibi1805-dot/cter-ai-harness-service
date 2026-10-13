import * as crypto from 'crypto';
import { normalizeText } from '../../../rag/textNormalizer';

export const MARKDOWN_EXTENSION = '.md';
export const MAX_VAULT_PATH_LENGTH = 1024;

/** A markdown document stored in the vault, with its indexing state. */
export interface VaultEntry {
  filePath: string;
  hash: string;
  chunkIds: string[];
  indexed: boolean;
  updatedAt: string;
  content: string;
  folderPath?: string;
  depth?: number;
}

export type NewVaultEntry = Pick<VaultEntry, 'filePath' | 'hash' | 'chunkIds' | 'indexed' | 'content'>;

export interface VaultFolder {
  path: string;
  depth: number;
  fileCount: number;
}

export interface VaultFolderGroup {
  folderPath: string;
  fileCount: number;
}

export interface VaultStats {
  total: number;
  indexed: number;
}

/** md5 of the normalized content — the change-detection key for re-indexing. */
export function computeContentHash(content: string): string {
  return crypto.createHash('md5').update(normalizeText(content)).digest('hex');
}

export function folderPathOf(filePath: string): string {
  return filePath.includes('/') ? filePath.replace(/\/[^/]+$/, '') : '';
}

export function depthOf(filePath: string): number {
  return (filePath.match(/\//g) ?? []).length;
}

/**
 * Turns an uploaded file name into a vault-relative markdown path:
 * forward slashes, no leading slash, no `../`, extension forced to `.md`.
 */
export function toVaultFilePath(rawName: string): string {
  const relative = rawName.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\.\.\//g, '');
  return relative.endsWith(MARKDOWN_EXTENSION)
    ? relative
    : relative.replace(/\.[^.]+$/, MARKDOWN_EXTENSION);
}

export function isVaultPathTooLong(filePath: string): boolean {
  return filePath.length > MAX_VAULT_PATH_LENGTH;
}

/**
 * Expands per-folder file counts to every ancestor folder, so `a/b` with 2
 * files also counts 2 towards `a`. Sorted by path.
 */
export function summarizeFolders(groups: VaultFolderGroup[]): VaultFolder[] {
  const counts = new Map<string, number>();
  for (const { folderPath, fileCount } of groups) {
    if (!folderPath) continue;
    const parts = folderPath.split('/');
    for (let i = 1; i <= parts.length; i++) {
      const ancestor = parts.slice(0, i).join('/');
      counts.set(ancestor, (counts.get(ancestor) ?? 0) + fileCount);
    }
  }
  return [...counts.entries()]
    .map(([path, fileCount]) => ({ path, depth: path.split('/').length, fileCount }))
    .sort((a, b) => a.path.localeCompare(b.path));
}
