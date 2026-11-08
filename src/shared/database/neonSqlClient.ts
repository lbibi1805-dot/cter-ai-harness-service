import type { NeonSql } from './interfaces/database.interface';
import type { SqlClient, SqlStatement } from './interfaces/sqlClient.interface';
import { countingSqlClient } from './countingSqlClient';
import { dbQueryCounter, type DbQueryCounter } from './dbQueryCounter';

/**
 * Adapts Neon's HTTP driver to `SqlClient`. `transaction` sends the whole batch
 * in a single HTTP request (non-interactive transaction). Every round-trip is
 * counted in RAM (`GET /api/metrics/db`).
 */
export function neonSqlClient(sql: NeonSql, counter: DbQueryCounter = dbQueryCounter): SqlClient {
  return countingSqlClient(rawNeonSqlClient(sql), counter);
}

function rawNeonSqlClient(sql: NeonSql): SqlClient {
  return {
    async query<T>(text: string, params: unknown[] = []): Promise<T[]> {
      return (await sql.query(text, params)) as T[];
    },
    async transaction(statements: SqlStatement[]): Promise<unknown[][]> {
      if (statements.length === 0) return [];
      // Test doubles only implement `query`: run sequentially then.
      if (typeof sql.transaction !== 'function') {
        const results: unknown[][] = [];
        for (const s of statements) results.push((await sql.query(s.text, s.params ?? [])) as unknown[]);
        return results;
      }
      return (await sql.transaction(statements.map((s) => sql.query(s.text, s.params ?? [])))) as unknown[][];
    },
  };
}
