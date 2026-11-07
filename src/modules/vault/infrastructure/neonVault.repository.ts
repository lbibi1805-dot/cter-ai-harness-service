import { SchemaGuard } from '../../../shared/database/database';
import type { SqlClient } from '../../../shared/database/interfaces/sqlClient.interface';
import { ConflictError } from '../../../shared/errors';
import {
  VaultEntryStatus,
  summarizeFolders,
  type IndexedVersion,
  type PagedResult,
  type VaultEntry,
  type VaultFolder,
  type VaultRepository,
  type VaultSearchCriteria,
  type VaultStats,
  type VaultVersion,
} from '../domain';
import { buildWhere, escapeLike, manifestRowToVaultEntry } from './helpers/neonVault.helper';
import { VaultManifestRow } from './interfaces/neonVault.interface';
import { VAULT_COLUMNS, VAULT_SCHEMA_STATEMENTS } from './constants/vaultSchema.constants';

const UNIQUE_VIOLATION = '23505';
const DELETING = VaultEntryStatus.DELETING;

/** Vault manifest in Postgres (Neon in prod). Every query is parameterized and is one round-trip. */
export class NeonVaultRepository implements VaultRepository {
  private readonly schema: SchemaGuard;

  constructor(private readonly sql: SqlClient) {
    this.schema = new SchemaGuard(sql, VAULT_SCHEMA_STATEMENTS);
  }

  async search(criteria: VaultSearchCriteria): Promise<PagedResult<VaultEntry>> {
    const where = buildWhere(criteria);
    const limitIndex = where.params.length + 1;
    // One round-trip: the total rides along on every row (window function).
    const rows = await this.rows<VaultManifestRow & { total: number }>(
      `SELECT ${VAULT_COLUMNS}, COUNT(*) OVER()::int AS total FROM vault_manifest ${where.sql}
       ORDER BY file_path ASC LIMIT $${limitIndex} OFFSET $${limitIndex + 1}`,
      [...where.params, criteria.limit, criteria.offset],
    );
    if (rows.length === 0 && criteria.offset > 0) {
      const [count] = await this.rows<{ c: number }>(`SELECT COUNT(*)::int AS c FROM vault_manifest ${where.sql}`, where.params);
      return { items: [], total: count.c };
    }
    return { items: rows.map(manifestRowToVaultEntry), total: rows[0]?.total ?? 0 };
  }

  async findAll(): Promise<VaultEntry[]> {
    return this.entries(`SELECT ${VAULT_COLUMNS} FROM vault_manifest WHERE status <> $1 ORDER BY file_path ASC`, [DELETING]);
  }

  async findByFolder(folder: string): Promise<VaultEntry[]> {
    const where = buildWhere({ folder });
    return this.entries(`SELECT ${VAULT_COLUMNS} FROM vault_manifest ${where.sql} ORDER BY file_path ASC`, where.params);
  }

  async findByPath(filePath: string): Promise<VaultEntry | null> {
    const [entry] = await this.entries(`SELECT ${VAULT_COLUMNS} FROM vault_manifest WHERE file_path = $1`, [filePath]);
    return entry ?? null;
  }

  async findDeleting(): Promise<VaultEntry[]> {
    return this.entries(`SELECT ${VAULT_COLUMNS} FROM vault_manifest WHERE status = $1 ORDER BY file_path ASC`, [DELETING]);
  }

  async listFolders(): Promise<VaultFolder[]> {
    const rows = await this.rows<{ folder_path: string; file_count: number }>(
      `SELECT folder_path, COUNT(*)::int AS file_count
       FROM vault_manifest WHERE folder_path <> '' AND status <> $1 GROUP BY folder_path`,
      [DELETING],
    );
    return summarizeFolders(rows.map((r) => ({ folderPath: r.folder_path, fileCount: Number(r.file_count) })));
  }

  async stats(): Promise<VaultStats> {
    const [row] = await this.rows<VaultStats>(
      'SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE indexed)::int AS indexed FROM vault_manifest WHERE status <> $1',
      [DELETING],
    );
    return { total: Number(row.total), indexed: Number(row.indexed) };
  }

  /** Insert or point an existing row at new content. `doc_id` is kept on update (stable id). */
  async saveVersion(v: VaultVersion): Promise<VaultEntry> {
    const [entry] = await this.entries(
      `INSERT INTO vault_manifest (file_path, doc_id, hash, object_key, size_bytes, content_type, source_type, chunk_ids, indexed, status, last_error, updated_at)
       VALUES ($1, $2::uuid, $3, $4, $5, $6, $7, '[]'::jsonb, false, $8, NULL, now())
       ON CONFLICT (file_path) DO UPDATE SET
         hash = EXCLUDED.hash, object_key = EXCLUDED.object_key, size_bytes = EXCLUDED.size_bytes,
         content_type = EXCLUDED.content_type, source_type = EXCLUDED.source_type,
         indexed = false, status = EXCLUDED.status, last_error = NULL, updated_at = now()
       RETURNING ${VAULT_COLUMNS}`,
      [v.filePath, v.docId, v.hash, v.objectKey, v.sizeBytes, v.contentType, v.sourceType, VaultEntryStatus.INDEXING],
    );
    return entry;
  }

  async commitIndexed(v: IndexedVersion): Promise<VaultEntry | null> {
    const [entry] = await this.entries(
      `UPDATE vault_manifest SET chunk_ids = $3::jsonb, indexed_hash = $2, indexed = true, status = $4, last_error = NULL, updated_at = now()
       WHERE doc_id = $1::uuid AND hash = $2 AND status <> $5
       RETURNING ${VAULT_COLUMNS}`,
      [v.docId, v.hash, JSON.stringify(v.chunkIds), VaultEntryStatus.ACTIVE, DELETING],
    );
    return entry ?? null;
  }

  async markFailed(docId: string, hash: string, error: string): Promise<VaultEntry | null> {
    const [entry] = await this.entries(
      `UPDATE vault_manifest SET status = $3, last_error = $4, updated_at = now()
       WHERE doc_id = $1::uuid AND hash = $2 AND status <> $5
       RETURNING ${VAULT_COLUMNS}`,
      [docId, hash, VaultEntryStatus.FAILED, error.slice(0, 2000), DELETING],
    );
    return entry ?? null;
  }

  async rename(filePath: string, newPath: string): Promise<VaultEntry | null> {
    try {
      const [entry] = await this.entries(
        `UPDATE vault_manifest SET file_path = $2, updated_at = now() WHERE file_path = $1 AND status <> $3 RETURNING ${VAULT_COLUMNS}`,
        [filePath, newPath, DELETING],
      );
      return entry ?? null;
    } catch (err) {
      if ((err as { code?: string }).code === UNIQUE_VIOLATION) throw new ConflictError(`A file already exists at ${newPath}`);
      throw err;
    }
  }

  async markDeleting(filePath: string): Promise<VaultEntry | null> {
    const [entry] = await this.entries(
      `UPDATE vault_manifest SET status = $2, updated_at = now() WHERE file_path = $1 RETURNING ${VAULT_COLUMNS}`,
      [filePath, DELETING],
    );
    return entry ?? null;
  }

  async markFolderDeleting(folder: string): Promise<VaultEntry[]> {
    return this.entries(
      `UPDATE vault_manifest SET status = $3, updated_at = now() WHERE file_path = $1 OR file_path LIKE $2 RETURNING ${VAULT_COLUMNS}`,
      [folder, `${escapeLike(folder)}/%`, DELETING],
    );
  }

  async markAllDeleting(): Promise<VaultEntry[]> {
    return this.entries(`UPDATE vault_manifest SET status = $1, updated_at = now() RETURNING ${VAULT_COLUMNS}`, [DELETING]);
  }

  async removeDeleted(docId: string): Promise<boolean> {
    const rows = await this.rows('DELETE FROM vault_manifest WHERE doc_id = $1::uuid AND status = $2 RETURNING doc_id', [docId, DELETING]);
    return rows.length > 0;
  }

  async removeAllDeleted(): Promise<number> {
    const rows = await this.rows('DELETE FROM vault_manifest WHERE status = $1 RETURNING doc_id', [DELETING]);
    return rows.length;
  }

  private async entries(text: string, params: unknown[]): Promise<VaultEntry[]> {
    return (await this.rows<VaultManifestRow>(text, params)).map(manifestRowToVaultEntry);
  }

  private async rows<T>(text: string, params: unknown[] = []): Promise<T[]> {
    await this.schema.ensure();
    return this.sql.query<T>(text, params);
  }
}
