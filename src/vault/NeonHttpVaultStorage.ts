import { neon } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';
import type { VaultEntry, VaultStorage } from './VaultStorage';

export class NeonHttpVaultStorage implements VaultStorage {
  private sql: ReturnType<typeof neon>;

  constructor(databaseUrl?: string) {
    const url = databaseUrl ?? process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL missing for postgres-r2');
    this.sql = neon(url);
  }

  async init(): Promise<void> {
    const ddl = fs.readFileSync(path.resolve(process.cwd(), 'migrations/001_vault_manifest.sql'), 'utf-8');
    for (const stmt of ddl.split(';').map(s => s.trim()).filter(Boolean)) {
      await (this.sql as any).query(stmt);
    }
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
    if (opts?.folder) { where.push(`(file_path = '${opts.folder.replace(/'/g, "''")}' OR file_path LIKE '${opts.folder.replace(/'/g, "''")}/%')`); }
    if (opts?.q) { where.push(`file_path ILIKE '%${String(opts.q).replace(/'/g, "''")}%'`); }
    if (typeof opts?.indexed === 'boolean') { where.push(`indexed = ${opts.indexed}`); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const totalRows = await (this.sql as any).query(`SELECT COUNT(*)::int AS c FROM vault_manifest ${whereSql}`);
    const total = (totalRows as any[])[0].c as number;
    const limit = opts?.limit ?? 50;
    const offset = opts?.offset ?? 0;
    const rows = await (this.sql as any).query(`SELECT * FROM vault_manifest ${whereSql} ORDER BY file_path ASC LIMIT ${limit} OFFSET ${offset}`);
    return { entries: (rows as any[]).map(r => this.rowToEntry(r)), total };
  }

  async get(filePath: string): Promise<VaultEntry | null> {
    const rows = await (this.sql as any).query('SELECT * FROM vault_manifest WHERE file_path = $1', [filePath]);
    const r = (rows as any[])[0];
    return r ? this.rowToEntry(r) : null;
  }

  async upsert(entry: Omit<VaultEntry, 'updatedAt' | 'folderPath' | 'depth'>): Promise<void> {
    await (this.sql as any).query(
      `INSERT INTO vault_manifest (file_path, hash, chunk_ids, indexed, updated_at)
       VALUES ($1,$2,$3::jsonb,$4, now())
       ON CONFLICT (file_path) DO UPDATE SET hash=EXCLUDED.hash, chunk_ids=EXCLUDED.chunk_ids, indexed=EXCLUDED.indexed, updated_at=now()`,
      [entry.filePath, entry.hash, JSON.stringify(entry.chunkIds), entry.indexed]
    );
  }

  async remove(filePath: string): Promise<void> {
    await (this.sql as any).query('DELETE FROM vault_manifest WHERE file_path = $1', [filePath]);
  }

  async listFolders(): Promise<{ path: string; depth: number; fileCount: number }[]> {
    const rows = await (this.sql as any).query(`
      SELECT folder_path AS path, depth, COUNT(*)::int AS file_count
      FROM vault_manifest WHERE folder_path <> '' GROUP BY folder_path, depth ORDER BY folder_path ASC
    `);
    const map = new Map<string, number>();
    for (const row of rows as any[]) {
      const parts = String(row.path).split('/');
      for (let i = 1; i <= parts.length; i++) {
        const p = parts.slice(0, i).join('/');
        map.set(p, (map.get(p) ?? 0) + Number(row.file_count));
      }
    }
    return [...map.entries()].map(([p, c]) => ({ path: p, depth: p.split('/').length, fileCount: c })).sort((a, b) => a.path.localeCompare(b.path));
  }

  async stats(): Promise<{ total: number; indexed: number }> {
    const rows = await (this.sql as any).query('SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE indexed)::int AS indexed FROM vault_manifest');
    const r = (rows as any[])[0];
    return { total: r.total, indexed: r.indexed };
  }
}
