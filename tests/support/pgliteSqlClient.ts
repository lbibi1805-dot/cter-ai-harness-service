import { PGlite } from '@electric-sql/pglite';
import type { SqlClient, SqlStatement } from '../../src/shared/database/interfaces/sqlClient.interface';

/**
 * In-process Postgres (PGlite, WASM) behind the same `SqlClient` port as Neon:
 * integration tests run real SQL without Docker and without spending Neon
 * compute. `roundTrips` counts calls the way Neon would bill them (one per
 * query, one per transaction batch). `failNext` injects a database failure.
 */
export class PgliteSqlClient implements SqlClient {
  roundTrips = 0;
  statements: string[] = [];
  private failures = 0;

  constructor(readonly db: PGlite = new PGlite()) {}

  failNext(times = 1): void {
    this.failures += times;
  }

  resetCounters(): void {
    this.roundTrips = 0;
    this.statements = [];
  }

  async query<T>(text: string, params: unknown[] = []): Promise<T[]> {
    this.tick(text);
    const result = await this.db.query<T>(text, params as unknown[]);
    return result.rows;
  }

  async transaction(statements: SqlStatement[]): Promise<unknown[][]> {
    this.tick(statements.map((s) => s.text).join(';\n'));
    return this.db.transaction(async (tx) => {
      const results: unknown[][] = [];
      for (const s of statements) results.push((await tx.query(s.text, (s.params ?? []) as unknown[])).rows as unknown[]);
      return results;
    });
  }

  async close(): Promise<void> {
    await this.db.close();
  }

  private tick(text: string): void {
    this.roundTrips++;
    this.statements.push(text);
    if (this.failures > 0) {
      this.failures--;
      throw new Error('injected database failure');
    }
  }
}
