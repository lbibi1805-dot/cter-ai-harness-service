-- Durable polling watermark per (job, account). Applied at runtime by NeonPollCursorRepository.
CREATE TABLE IF NOT EXISTS poll_cursor (
  job TEXT NOT NULL,
  account_index INT NOT NULL,
  cursor_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (job, account_index)
);
