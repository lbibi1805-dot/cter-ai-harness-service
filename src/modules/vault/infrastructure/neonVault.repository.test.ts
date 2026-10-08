import { describe, it, expect, vi } from 'vitest';
import { NeonVaultRepository, type NeonSql } from './neonVault.repository';
import { VAULT_SCHEMA_STATEMENTS } from './vaultSchema';

interface RecordedQuery {
  text: string;
  params?: unknown[];
}

function fakeSql(respond: (text: string) => unknown[] = () => []) {
  const queries: RecordedQuery[] = [];
  const query = vi.fn(async (text: string, params?: unknown[]) => {
    queries.push({ text, params });
    return respond(text);
  });
  return { sql: { query } as unknown as NeonSql, queries, query };
}

function appQueries(queries: RecordedQuery[]): RecordedQuery[] {
  return queries.slice(VAULT_SCHEMA_STATEMENTS.length);
}

describe('NeonVaultRepository', () => {
  it('applies the schema once before the first query', async () => {
    const { sql, queries } = fakeSql((t) => (t.includes('COUNT') ? [{ total: 0, indexed: 0 }] : []));
    const repo = new NeonVaultRepository(sql);
    await repo.stats();
    await repo.stats();
    expect(queries.filter((q) => q.text.startsWith('CREATE TABLE'))).toHaveLength(1);
  });

  it('retries schema setup after a failure', async () => {
    const { sql, query } = fakeSql();
    query.mockRejectedValueOnce(new Error('ECONNRESET'));
    const repo = new NeonVaultRepository(sql);
    await expect(repo.findAll()).rejects.toThrow('ECONNRESET');
    await expect(repo.findAll()).resolves.toEqual([]);
  });

  it('passes search filters as parameters, never inline', async () => {
    const { sql, queries } = fakeSql((t) => (t.includes('COUNT') ? [{ c: 0 }] : []));
    const repo = new NeonVaultRepository(sql);
    await repo.search({ folder: "lab'; DROP TABLE x;--", text: 'req', indexed: true, limit: 20, offset: 40 });

    const [count, select] = appQueries(queries);
    expect(count.text).not.toContain('DROP');
    expect(count.params).toEqual(["lab'; DROP TABLE x;--", "lab'; DROP TABLE x;--/%", '%req%', true]);
    expect(select.text).toContain('LIMIT $5 OFFSET $6');
    expect(select.params).toEqual([...count.params!, 20, 40]);
  });

  it('maps rows to entries', async () => {
    const row = {
      file_path: 'a/b.md', hash: 'h', chunk_ids: '["c1"]', indexed: true,
      updated_at: new Date('2026-01-01T00:00:00Z'), content: null, folder_path: null, depth: null,
    };
    const { sql } = fakeSql((t) => (t.startsWith('SELECT *') ? [row] : []));
    const entry = await new NeonVaultRepository(sql).findByPath('a/b.md');
    expect(entry).toEqual({
      filePath: 'a/b.md', hash: 'h', chunkIds: ['c1'], indexed: true,
      updatedAt: '2026-01-01T00:00:00.000Z', content: '', folderPath: 'a', depth: 1,
    });
  });

  it('upserts with JSON chunk ids', async () => {
    const { sql, queries } = fakeSql();
    await new NeonVaultRepository(sql).save({ filePath: 'a.md', hash: 'h', chunkIds: ['c1'], indexed: false, content: 'body' });
    const [upsert] = appQueries(queries);
    expect(upsert.text).toContain('ON CONFLICT (file_path)');
    expect(upsert.params).toEqual(['a.md', 'h', '["c1"]', false, 'body']);
  });
});
