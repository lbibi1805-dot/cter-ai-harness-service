import {
  MARKDOWN_CONTENT_TYPE,
  VaultEntryStatus,
  VaultSourceType,
  depthOf,
  folderPathOf,
  type VaultEntry,
  type VaultSearchCriteria,
} from '../../domain';
import { WhereClause, VaultManifestRow } from '../interfaces/neonVault.interface';

const STATUSES = new Set<string>(Object.values(VaultEntryStatus));

/** Every read hides `deleting` rows; `$n` placeholders continue after `params`. */
export function buildWhere(criteria: Partial<VaultSearchCriteria>): WhereClause {
  const params: unknown[] = [VaultEntryStatus.DELETING];
  const conditions: string[] = ['status <> $1'];
  if (criteria.folder) {
    params.push(criteria.folder, `${escapeLike(criteria.folder)}/%`);
    conditions.push(`(file_path = $${params.length - 1} OR file_path LIKE $${params.length})`);
  }
  if (criteria.text) {
    params.push(`%${escapeLike(criteria.text)}%`);
    conditions.push(`file_path ILIKE $${params.length}`);
  }
  if (typeof criteria.indexed === 'boolean') {
    params.push(criteria.indexed);
    conditions.push(`indexed = $${params.length}`);
  }
  return { sql: `WHERE ${conditions.join(' AND ')}`, params };
}

/** `_` and `%` in folder names must match literally. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export function manifestRowToVaultEntry(row: VaultManifestRow): VaultEntry {
  return {
    filePath: row.file_path,
    docId: row.doc_id,
    hash: row.hash,
    objectKey: row.object_key ?? '',
    chunkIds: Array.isArray(row.chunk_ids) ? row.chunk_ids : JSON.parse(row.chunk_ids ?? '[]'),
    indexed: row.indexed,
    indexedHash: row.indexed_hash ?? null,
    status: STATUSES.has(row.status) ? (row.status as VaultEntryStatus) : VaultEntryStatus.ACTIVE,
    sourceType: (row.source_type as VaultSourceType) ?? VaultSourceType.MARKDOWN,
    contentType: row.content_type ?? MARKDOWN_CONTENT_TYPE,
    sizeBytes: row.size_bytes === null || row.size_bytes === undefined ? null : Number(row.size_bytes),
    lastError: row.last_error ?? null,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    folderPath: row.folder_path ?? folderPathOf(row.file_path),
    depth: typeof row.depth === 'number' ? row.depth : depthOf(row.file_path),
  };
}
