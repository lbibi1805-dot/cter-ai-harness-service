import { SchemaGuard } from '../../../shared/database/database';
import type { SqlClient } from '../../../shared/database/interfaces/sqlClient.interface';
import type { PollCursorEntry, PollCursorRepository, PollJobName } from '../domain';
import { CursorRow } from './interfaces/neonPollCursor.interface';
import { POLL_CURSOR_SCHEMA_STATEMENTS, SELECT_POLL_CURSOR_SQL, UPSERT_POLL_CURSOR_SQL } from './constants/pollCursorSchema.constants';

/** Poll cursors in Postgres (Neon in prod). Wrapped by `CachedPollCursorRepository` so Neon can sleep. */
export class NeonPollCursorRepository implements PollCursorRepository {
  private readonly schema: SchemaGuard;

  constructor(private readonly sql: SqlClient) {
    this.schema = new SchemaGuard(sql, POLL_CURSOR_SCHEMA_STATEMENTS);
  }

  async get(job: PollJobName, accountIndex: number): Promise<Date | null> {
    await this.schema.ensure();
    const rows = await this.sql.query<CursorRow>(SELECT_POLL_CURSOR_SQL, [job, accountIndex]);
    return rows[0] ? new Date(rows[0].cursor_at) : null;
  }

  /** Never moves a cursor backwards, even if two writers race. */
  async save(job: PollJobName, accountIndex: number, cursor: Date): Promise<void> {
    await this.saveMany([{ job, accountIndex, cursor }]);
  }

  /** Every entry in ONE round-trip (a single transaction batch). */
  async saveMany(entries: PollCursorEntry[]): Promise<void> {
    if (entries.length === 0) return;
    await this.schema.ensure();
    const statements = entries.map((e) => ({ text: UPSERT_POLL_CURSOR_SQL, params: [e.job, e.accountIndex, e.cursor.toISOString()] }));
    if (statements.length === 1) await this.sql.query(statements[0].text, statements[0].params);
    else await this.sql.transaction(statements);
  }
}
