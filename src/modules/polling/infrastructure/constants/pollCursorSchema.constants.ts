/** Idempotent schema for poll cursors. Mirrors migrations/003_poll_cursor.sql. */
export const POLL_CURSOR_SCHEMA_STATEMENTS: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS poll_cursor (
    job TEXT NOT NULL,
    account_index INT NOT NULL,
    cursor_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (job, account_index)
  )`,
];

export const SELECT_POLL_CURSOR_SQL = 'SELECT cursor_at FROM poll_cursor WHERE job = $1 AND account_index = $2';

/** Never moves a cursor backwards, even if two writers race. */
export const UPSERT_POLL_CURSOR_SQL = `INSERT INTO poll_cursor (job, account_index, cursor_at, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (job, account_index) DO UPDATE
         SET cursor_at = GREATEST(poll_cursor.cursor_at, EXCLUDED.cursor_at), updated_at = now()`;
