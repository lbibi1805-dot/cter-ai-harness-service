import type { NeonQueryFunction } from '@neondatabase/serverless';
import {
  depthOf,
  folderPathOf,
  summarizeFolders,
  type NewVaultEntry,
  type PagedResult,
  type VaultEntry,
  type VaultFolder,
  type VaultRepository,
  type VaultSearchCriteria,
  type VaultStats,
} from '../domain';
import { VAULT_SCHEMA_STATEMENTS } from './vaultSchema';

export type NeonSql = NeonQueryFunction<false, false>;

interface VaultManifestRow {
  file_path: string;
  hash: string;
  chunk_ids: string[] | string | null;
  indexed: boolean;
  updated_at: Date | string;
  content: string | null;
  folder_path: string | null;
  depth: number | null;
}

interface WhereClause {
  sql: string;
  params: unknown[];
}

/** Vault manifest in Neon Postgres. Every query is parameterized. */
export class NeonVaultRepository implements VaultRepository {
  private schemaReady: Promise<void> | null = null;

  constructor(private readonly sql: NeonSql) {}

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
    return { items: rows.map(toEntry), total: countRow.c };
  }

  async findAll(): Promise<VaultEntry[]> {
    const rows = await this.rows<VaultManifestRow>('SELECT * FROM vault_manifest ORDER BY file_path ASC');
    return rows.map(toEntry);
  }

  async findByFolder(folder: string): Promise<VaultEntry[]> {
    const where = buildWhere({ folder });
    const rows = await this.rows<VaultManifestRow>(
      `SELECT * FROM vault_manifest ${where.sql} ORDER BY file_path ASC`,
      where.params,
    );
    return rows.map(toEntry);
  }

  async findByPath(filePath: string): Promise<VaultEntry | null> {
    const [row] = await this.rows<VaultManifestRow>('SELECT * FROM vault_manifest WHERE file_path = $1', [filePath]);
    return row ? toEntry(row) : null;
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
    await this.ensureSchema();
    return (await this.sql.query(text, params)) as T[];
  }

  /** Applies the schema once; a failed attempt is retried on the next query. */
  private ensureSchema(): Promise<void> {
    if (!this.schemaReady) {
      this.schemaReady = this.applySchema().catch((err) => {
        this.schemaReady = null;
        throw err;
      });
    }
    return this.schemaReady;
  }

  private async applySchema(): Promise<void> {
    for (const statement of VAULT_SCHEMA_STATEMENTS) await this.sql.query(statement);
  }
}

function buildWhere(criteria: Partial<VaultSearchCriteria>): WhereClause {
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

function toEntry(row: VaultManifestRow): VaultEntry {
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
