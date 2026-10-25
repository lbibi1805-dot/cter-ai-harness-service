import { depthOf, folderPathOf, type VaultEntry, type VaultSearchCriteria } from '../../domain';
import { WhereClause, VaultManifestRow } from '../interfaces/neonVault.interface';

export function buildWhere(criteria: Partial<VaultSearchCriteria>): WhereClause {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (criteria.folder) {
    params.push(criteria.folder, `${criteria.folder}/%`);
    conditions.push(`(file_path = $${params.length - 1} OR file_path LIKE $${params.length})`);
  }
  if (criteria.text) {
    params.push(`%${criteria.text}%`);
    conditions.push(`file_path ILIKE $${params.length}`);
  }
  if (typeof criteria.indexed === 'boolean') {
    params.push(criteria.indexed);
    conditions.push(`indexed = $${params.length}`);
  }
  return { sql: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '', params };
}

export function manifestRowToVaultEntry(row: VaultManifestRow): VaultEntry {
  return {
    filePath: row.file_path,
    hash: row.hash,
    chunkIds: Array.isArray(row.chunk_ids) ? row.chunk_ids : JSON.parse(row.chunk_ids ?? '[]'),
    indexed: row.indexed,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    content: row.content ?? '',
    folderPath: row.folder_path ?? folderPathOf(row.file_path),
    depth: typeof row.depth === 'number' ? row.depth : depthOf(row.file_path),
  };
}
