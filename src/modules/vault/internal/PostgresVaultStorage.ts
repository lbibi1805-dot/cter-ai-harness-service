import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import type { VaultEntry } from '../dto';
import type { VaultStorage } from '../ports';
import { rowToVaultEntry, expandFolderCounts } from '../base';

/** Postgres-backed VaultStorage — moved from `src/vault/PostgresVaultStorage.ts`
 * (Phase 1, mục 6 Phase 1 step 2). `rowToEntry`/folder-expansion logic now delegates
 * to the shared `modules/vault/base.ts` helpers (previously ~87% duplicated with
 * `NeonHttpVaultStorage`) — verified behavior-identical by `base.test.ts` first. */
export class PostgresVaultStorage implements VaultStorage {
  private pool: Pool;

  constructor(databaseUrl?: string) {
    let url = databaseUrl ?? process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL missing for postgres-r2');
    // Suppress pg v8 SECURITY WARNING without breaking Neon channel_binding: keep channel_binding, add uselibpqcompat
    try {
      const u = new URL(url);
      if (!u.searchParams.has('uselibpqcompat')) u.searchParams.set('uselibpqcompat', 'true');
      url = u.toString();
    } catch {}
    this.pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
  }

  async init(): Promise<void> {
    const ddl = fs.readFileSync(path.resolve(process.cwd(), 'migrations/001_vault_manifest.sql'), 'utf-8');
    await this.pool.query(ddl);
  }

  async list(opts?: { folder?: string; q?: string; indexed?: boolean; limit?: number; offset?: number }): Promise<{ entries: VaultEntry[]; total: number }> {
    const where: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;
    if (opts?.folder) { where.push(`file_path = $${idx} OR file_path LIKE $${idx + 1}`); vals.push(opts.folder, opts.folder + '/%'); idx += 2; }
    if (opts?.q) { where.push(`file_path ILIKE $${idx}`); vals.push(`%${opts.q}%`); idx++; }
    if (typeof opts?.indexed === 'boolean') { where.push(`indexed = $${idx}`); vals.push(opts.indexed); idx++; }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const totalRes = await this.pool.query(`SELECT COUNT(*)::int AS c FROM vault_manifest ${whereSql}`, vals);
    const total = totalRes.rows[0].c as number;
    const limit = opts?.limit ?? 50;
    const offset = opts?.offset ?? 0;
    const rows = await this.pool.query(`SELECT * FROM vault_manifest ${whereSql} ORDER BY file_path ASC LIMIT $${idx} OFFSET $${idx + 1}`, [...vals, limit, offset]);
    return { entries: rows.rows.map(r => rowToVaultEntry(r)), total };
  }

  async get(filePath: string): Promise<VaultEntry | null> {
    const r = await this.pool.query('SELECT * FROM vault_manifest WHERE file_path=$1', [filePath]);
    return r.rows[0] ? rowToVaultEntry(r.rows[0]) : null;
  }

  async upsert(entry: Omit<VaultEntry, 'updatedAt' | 'folderPath' | 'depth'>): Promise<void> {
    await this.pool.query(
      `INSERT INTO vault_manifest (file_path, hash, chunk_ids, indexed, updated_at)
       VALUES ($1,$2,$3::jsonb,$4, now())
       ON CONFLICT (file_path) DO UPDATE SET hash=EXCLUDED.hash, chunk_ids=EXCLUDED.chunk_ids, indexed=EXCLUDED.indexed, updated_at=now()`,
      [entry.filePath, entry.hash, JSON.stringify(entry.chunkIds), entry.indexed]
    );
  }

  async remove(filePath: string): Promise<void> {
    await this.pool.query('DELETE FROM vault_manifest WHERE file_path=$1', [filePath]);
  }

  async listFolders(): Promise<{ path: string; depth: number; fileCount: number }[]> {
    const r = await this.pool.query(`
      SELECT folder_path AS path, depth, COUNT(*)::int AS file_count
      FROM vault_manifest
      WHERE folder_path <> ''
      GROUP BY folder_path, depth
      ORDER BY folder_path ASC
    `);
    // Expand intermediate folders not directly stored (e.g., a/b/c.md -> a, a/b)
    return expandFolderCounts(r.rows as { path: string; file_count: number }[]);
  }

  async stats(): Promise<{ total: number; indexed: number }> {
    const r = await this.pool.query('SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE indexed)::int AS indexed FROM vault_manifest');
    return { total: r.rows[0].total, indexed: r.rows[0].indexed };
  }
}
