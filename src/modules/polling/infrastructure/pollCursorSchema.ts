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
