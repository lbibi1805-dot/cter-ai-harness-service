import { describe, it, expect, vi } from 'vitest';
import { countingSqlClient } from '../../../../src/shared/database/countingSqlClient';
import { DbQueryCounter } from '../../../../src/shared/database/dbQueryCounter';
import { sqlTag } from '../../../../src/shared/database/helpers/sqlTag.helper';
import { neonSqlClient } from '../../../../src/shared/database/neonSqlClient';
import type { NeonSql } from '../../../../src/shared/database/interfaces/database.interface';
import type { SqlClient } from '../../../../src/shared/database/interfaces/sqlClient.interface';

function fakeClient(fail = false): SqlClient & { calls: number } {
  const client = {
    calls: 0,
    async query<T>(): Promise<T[]> {
      client.calls++;
      if (fail) throw new Error('db down');
      return [] as T[];
    },
    async transaction(): Promise<unknown[][]> {
      client.calls++;
      return [];
    },
  };
  return client;
}

describe('sqlTag', () => {
  it('derives verb + table from the statement', () => {
    expect(sqlTag('SELECT cursor_at FROM poll_cursor WHERE job = $1')).toBe('SELECT poll_cursor');
    expect(sqlTag('  insert into vault_manifest (a) VALUES ($1) ON CONFLICT (a) DO NOTHING')).toBe('INSERT vault_manifest');
    expect(sqlTag('UPDATE conversations SET x = 1')).toBe('UPDATE conversations');
    expect(sqlTag('DELETE FROM messages WHERE id = $1')).toBe('DELETE messages');
    expect(sqlTag('CREATE TABLE IF NOT EXISTS poll_cursor (job TEXT)')).toBe('CREATE poll_cursor');
    expect(sqlTag('SELECT 1')).toBe('SELECT');
    expect(sqlTag('')).toBe('unknown');
  });
});

describe('countingSqlClient', () => {
  it('counts each round-trip with time and tag; a transaction batch counts once', async () => {
    let now = 1_000;
    const counter = new DbQueryCounter(() => now);
    const sql = countingSqlClient(fakeClient(), counter);
    await sql.query('SELECT * FROM poll_cursor');
    now = 5_000;
    await sql.transaction([{ text: 'INSERT INTO poll_cursor VALUES (1)' }, { text: 'UPDATE poll_cursor SET x = 1' }]);
    await sql.transaction([]);
    const stats = counter.snapshot();
    expect(stats.queriesSinceBoot).toBe(2);
    expect(stats.transactionsSinceBoot).toBe(1);
    expect(stats.lastQueryAt).toBe(new Date(5_000).toISOString());
    expect(stats.lastQueryTag).toBe('TX INSERT poll_cursor +1');
    expect(stats.byTag).toEqual({ 'SELECT poll_cursor': 1, 'TX INSERT poll_cursor +1': 1 });
  });

  it('prefixes an explicit label and counts failures', async () => {
    const counter = new DbQueryCounter();
    const sql = countingSqlClient(fakeClient(true), counter, 'vault');
    await expect(sql.query('SELECT 1')).rejects.toThrow('db down');
    expect(counter.snapshot()).toMatchObject({ queriesSinceBoot: 1, failedQueries: 1, lastQueryTag: 'vault: SELECT' });
  });

  it('neonSqlClient reports to the counter it is given', async () => {
    const counter = new DbQueryCounter();
    const query = vi.fn(async () => []);
    const sql = neonSqlClient({ query } as unknown as NeonSql, counter);
    await sql.query('SELECT 1');
    expect(counter.count()).toBe(1);
    expect(query).toHaveBeenCalledTimes(1);
  });
});
