import * as crypto from 'crypto';
import { normalizeText } from '../../retrieval/domain/textNormalizer';
import {
  CHUNK_ID_HASH_CHARS,
  CHUNK_ID_INDEX_DIGITS,
  CHUNK_ID_SEPARATOR,
  MARKDOWN_EXTENSION,
  MAX_VAULT_PATH_LENGTH,
} from './constants/vaultEntry.constants';
import { VaultEntryStatus } from './enums/vault.enums';
import { VaultEntry, VaultFolderGroup, VaultFolder } from './interfaces/vaultEntry.interface';

const VAULT_KEY_PREFIX = 'vault/';
const DERIVED_KEY_PREFIX = 'derived/';
const BOM = /^﻿/;
const CRLF = /\r\n?/g;
const LF = String.fromCharCode(10);
/** The extension of the last path segment (dots in folder names are kept). */
const LAST_EXTENSION = /\.[^./]+$/;

/**
 * The canonical text stored for a vault file: math-alphanumeric characters
 * mapped (as before), BOM dropped, CRLF → LF, trailing whitespace at the end
 * trimmed — so the same note saved on Windows or macOS hashes the same.
 */
export function normalizeVaultContent(content: string): string {
  return normalizeText(content).replace(BOM, '').replace(CRLF, LF).trimEnd();
}

/** md5 of the normalized content — the change-detection key for re-indexing (not the R2 ETag). */
export function computeContentHash(content: string): string {
  return crypto.createHash('md5').update(normalizeVaultContent(content)).digest('hex');
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
    : relative.replace(LAST_EXTENSION, '') + MARKDOWN_EXTENSION;
}

export function isVaultPathTooLong(filePath: string): boolean {
  return filePath.length > MAX_VAULT_PATH_LENGTH;
}

/**
 * Content-addressed object key: a new content gets a new key, so an upload
 * never overwrites the object the manifest currently points to, and a rename
 * only changes `file_path` in the manifest.
 */
export function vaultObjectKey(docId: string, hash: string, extension: string = MARKDOWN_EXTENSION): string {
  return `${VAULT_KEY_PREFIX}${docId}/${hash}${extension}`;
}

/** Every object prefix owned by one document (deleted together). */
export function vaultDocPrefixes(docId: string): string[] {
  return [`${VAULT_KEY_PREFIX}${docId}/`, `${DERIVED_KEY_PREFIX}${docId}/`];
}

/** `<docId>#` — lists/deletes every vector of a document by prefix. */
export function chunkIdPrefix(docId: string): string {
  return `${docId}${CHUNK_ID_SEPARATOR}`;
}

/** `<docId>#<hash8>#<idx3>`: unique across the vault (unlike file-name based ids), stable for the same content. */
export function chunkId(docId: string, hash: string, index: number): string {
  return `${chunkIdPrefix(docId)}${hash.slice(0, CHUNK_ID_HASH_CHARS)}${CHUNK_ID_SEPARATOR}${String(index).padStart(CHUNK_ID_INDEX_DIGITS, '0')}`;
}

/** Null for legacy ids (`<file>_<heading>_chunk_007`). */
export function parseChunkId(id: string): { docId: string; hash8: string; index: number } | null {
  const parts = id.split(CHUNK_ID_SEPARATOR);
  if (parts.length !== 3 || !parts[0] || parts[1].length !== CHUNK_ID_HASH_CHARS) return null;
  const index = Number(parts[2]);
  return Number.isInteger(index) ? { docId: parts[0], hash8: parts[1], index } : null;
}

/** A file needs (re-)indexing when its latest content is not the one behind the live vectors. */
export function needsIndexing(entry: VaultEntry): boolean {
  return entry.status !== VaultEntryStatus.DELETING && !!entry.objectKey && (entry.indexedHash !== entry.hash || !entry.indexed);
}

/** A row whose bytes live in object storage; legacy rows (content in Neon) have no object key and need a re-upload. */
export function hasStoredObject(entry: VaultEntry): boolean {
  return !!entry.objectKey;
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
