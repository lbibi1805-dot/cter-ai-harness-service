import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import type { VaultEntry, VaultStorage } from './VaultStorage';

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

  private rowToEntry(r: any): VaultEntry {
    return {
      filePath: r.file_path,
      hash: r.hash,
      chunkIds: Array.isArray(r.chunk_ids) ? r.chunk_ids : JSON.parse(r.chunk_ids ?? '[]'),
      indexed: r.indexed,
      updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
      folderPath: r.folder_path ?? (r.file_path.includes('/') ? r.file_path.replace(/\/[^/]+$/, '') : ''),
      depth: typeof r.depth === 'number' ? r.depth : (r.file_path.match(/\//g) || []).length,
    };
  }

  async list(opts?: { folder?: string; q?: string; indexed?: boolean; limit?: number; offset?: number }): Promise<{ entries: VaultEntry[]; total: number }> {
    const where: string[] = [];
    const vals: any[] = [];
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
    return { entries: rows.rows.map(r => this.rowToEntry(r)), total };
  }

  async get(filePath: string): Promise<VaultEntry | null> {
    const r = await this.pool.query('SELECT * FROM vault_manifest WHERE file_path=$1', [filePath]);
    return r.rows[0] ? this.rowToEntry(r.rows[0]) : null;
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
    const map = new Map<string, number>();
    for (const row of r.rows as any[]) {
      const parts = String(row.path).split('/');
      for (let i = 1; i <= parts.length; i++) {
        const p = parts.slice(0, i).join('/');
        map.set(p, (map.get(p) ?? 0) + Number(row.file_count));
      }
    }
    // dedup via map but keep depth from first occurrence
    return [...map.entries()].map(([p, c]) => ({ path: p, depth: p.split('/').length, fileCount: c })).sort((a, b) => a.path.localeCompare(b.path));
  }

  async stats(): Promise<{ total: number; indexed: number }> {
    const r = await this.pool.query('SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE indexed)::int AS indexed FROM vault_manifest');
    return { total: r.rows[0].total, indexed: r.rows[0].indexed };
  }
}
