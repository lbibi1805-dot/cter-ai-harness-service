import { SchemaGuard } from '../../../shared/database/database';
import {
  summarizeFolders,
  type NewVaultEntry,
  type PagedResult,
  type VaultEntry,
  type VaultFolder,
  type VaultRepository,
  type VaultSearchCriteria,
  type VaultStats,
} from '../domain';
import { NeonSql } from '../../../shared/database/interfaces/database.interface';
import { manifestRowToVaultEntry } from './helpers/neonVault.helper';
import { buildWhere } from './helpers/neonVault.helper';
import { VaultManifestRow } from './interfaces/neonVault.interface';
import { VAULT_SCHEMA_STATEMENTS } from './constants/vaultSchema.constants';

/** Vault manifest in Neon Postgres. Every query is parameterized. */
export class NeonVaultRepository implements VaultRepository {
  private readonly schema: SchemaGuard;

  constructor(private readonly sql: NeonSql) {
    this.schema = new SchemaGuard(sql, VAULT_SCHEMA_STATEMENTS);
  }

  async search(criteria: VaultSearchCriteria): Promise<PagedResult<VaultEntry>> {
    const where = buildWhere(criteria);
    const [countRow] = await this.rows<{ c: number }>(
      `SELECT COUNT(*)::int AS c FROM vault_manifest ${where.sql}`,
      where.params,
    );
    const limitIndex = where.params.length + 1;
    const rows = await this.rows<VaultManifestRow>(
      `SELECT * FROM vault_manifest ${where.sql} ORDER BY file_path ASC LIMIT $${limitIndex} OFFSET $${limitIndex + 1}`,
      [...where.params, criteria.limit, criteria.offset],
    );
    return { items: rows.map(manifestRowToVaultEntry), total: countRow.c };
  }

  async findAll(): Promise<VaultEntry[]> {
    const rows = await this.rows<VaultManifestRow>('SELECT * FROM vault_manifest ORDER BY file_path ASC');
    return rows.map(manifestRowToVaultEntry);
  }

  async findByFolder(folder: string): Promise<VaultEntry[]> {
    const where = buildWhere({ folder });
    const rows = await this.rows<VaultManifestRow>(
      `SELECT * FROM vault_manifest ${where.sql} ORDER BY file_path ASC`,
      where.params,
    );
    return rows.map(manifestRowToVaultEntry);
  }

  async findByPath(filePath: string): Promise<VaultEntry | null> {
    const [row] = await this.rows<VaultManifestRow>('SELECT * FROM vault_manifest WHERE file_path = $1', [filePath]);
    return row ? manifestRowToVaultEntry(row) : null;
  }

  async save(entry: NewVaultEntry): Promise<void> {
    await this.rows(
      `INSERT INTO vault_manifest (file_path, hash, chunk_ids, indexed, updated_at, content)
       VALUES ($1, $2, $3::jsonb, $4, now(), $5)
       ON CONFLICT (file_path) DO UPDATE SET
         hash = EXCLUDED.hash, chunk_ids = EXCLUDED.chunk_ids, indexed = EXCLUDED.indexed,
         updated_at = now(), content = EXCLUDED.content`,
      [entry.filePath, entry.hash, JSON.stringify(entry.chunkIds), entry.indexed, entry.content],
    );
  }

  async remove(filePath: string): Promise<void> {
    await this.rows('DELETE FROM vault_manifest WHERE file_path = $1', [filePath]);
  }

  async removeAll(): Promise<void> {
    await this.rows('DELETE FROM vault_manifest');
  }

  async listFolders(): Promise<VaultFolder[]> {
    const rows = await this.rows<{ folder_path: string; file_count: number }>(
      `SELECT folder_path, COUNT(*)::int AS file_count
       FROM vault_manifest WHERE folder_path <> '' GROUP BY folder_path`,
    );
    return summarizeFolders(rows.map((r) => ({ folderPath: r.folder_path, fileCount: Number(r.file_count) })));
  }

  async stats(): Promise<VaultStats> {
    const [row] = await this.rows<VaultStats>(
      'SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE indexed)::int AS indexed FROM vault_manifest',
    );
    return { total: row.total, indexed: row.indexed };
  }

  private async rows<T>(text: string, params: unknown[] = []): Promise<T[]> {
    await this.schema.ensure();
    return (await this.sql.query(text, params)) as T[];
  }
}
