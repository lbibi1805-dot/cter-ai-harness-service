import { NeonSql } from './interfaces/database.interface';

/**
 * Applies idempotent DDL once per repository. A failed attempt is forgotten so
 * the next query retries instead of failing forever after a cold-start blip.
 */
export class SchemaGuard {
  private ready: Promise<void> | null = null;

  constructor(
    private readonly sql: NeonSql,
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
    for (const statement of this.statements) await this.sql.query(statement);
  }
}
