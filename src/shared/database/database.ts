import type { SqlClient } from './interfaces/sqlClient.interface';

/**
 * Applies idempotent DDL once per repository, as ONE transaction (one
 * round-trip: keeps a Neon cold start short). A failed attempt is forgotten
 * so the next query retries instead of failing forever after a cold-start blip.
 */
export class SchemaGuard {
  private ready: Promise<void> | null = null;

  constructor(
    private readonly sql: SqlClient,
    private readonly statements: readonly string[],
  ) {}

  ensure(): Promise<void> {
    if (!this.ready) {
      this.ready = this.apply().catch((err) => {
        this.ready = null;
        throw err;
      });
    }
    return this.ready;
  }

  private async apply(): Promise<void> {
    await this.sql.transaction(this.statements.map((text) => ({ text })));
  }
}
