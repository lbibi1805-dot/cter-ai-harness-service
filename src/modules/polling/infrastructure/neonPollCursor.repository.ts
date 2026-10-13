import { SchemaGuard, type NeonSql } from '../../../shared/database/database';
import type { PollCursorRepository, PollJobName } from '../domain';
import { POLL_CURSOR_SCHEMA_STATEMENTS } from './pollCursorSchema';

interface CursorRow {
  cursor_at: Date | string;
}

export class NeonPollCursorRepository implements PollCursorRepository {
  private readonly schema: SchemaGuard;

  constructor(private readonly sql: NeonSql) {
    this.schema = new SchemaGuard(sql, POLL_CURSOR_SCHEMA_STATEMENTS);
  }

  async get(job: PollJobName, accountIndex: number): Promise<Date | null> {
    await this.schema.ensure();
    const rows = (await this.sql.query(
      'SELECT cursor_at FROM poll_cursor WHERE job = $1 AND account_index = $2',
      [job, accountIndex],
    )) as CursorRow[];
    return rows[0] ? new Date(rows[0].cursor_at) : null;
  }

  /** Never moves a cursor backwards, even if two writers race. */
  async save(job: PollJobName, accountIndex: number, cursor: Date): Promise<void> {
    await this.schema.ensure();
    await this.sql.query(
      `INSERT INTO poll_cursor (job, account_index, cursor_at, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (job, account_index) DO UPDATE
         SET cursor_at = GREATEST(poll_cursor.cursor_at, EXCLUDED.cursor_at), updated_at = now()`,
      [job, accountIndex, cursor.toISOString()],
    );
  }
}
