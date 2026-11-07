/**
 * Idempotent schema for `vault_manifest`. Mirrors migrations/001, 002 and 004
 * and is applied at runtime (one transaction) because the Docker image does
 * not ship the migrations dir.
 *
 * The legacy `content` column is NOT dropped here: dropping it on deploy would
 * destroy prod data before the operator ran the reset. See
 * migrations/006_drop_legacy_vault_content.sql (run manually after the reset).
 */
export const VAULT_SCHEMA_STATEMENTS: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS vault_manifest (
    file_path TEXT PRIMARY KEY CHECK (length(file_path) < 1024),
    hash TEXT NOT NULL,
    chunk_ids JSONB NOT NULL DEFAULT '[]',
    indexed BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    folder_path TEXT GENERATED ALWAYS AS (regexp_replace(file_path, '/[^/]+$', '')) STORED,
    depth INT GENERATED ALWAYS AS (length(file_path) - length(replace(file_path,'/',''))) STORED
  )`,
  'CREATE INDEX IF NOT EXISTS idx_vault_manifest_indexed ON vault_manifest(indexed)',
  'CREATE INDEX IF NOT EXISTS idx_vault_manifest_folder ON vault_manifest(folder_path)',
  'CREATE INDEX IF NOT EXISTS idx_vault_manifest_depth ON vault_manifest(depth)',
  // 004: object storage + sync state machine
  "ALTER TABLE vault_manifest ADD COLUMN IF NOT EXISTS object_key TEXT NOT NULL DEFAULT ''",
  'ALTER TABLE vault_manifest ADD COLUMN IF NOT EXISTS size_bytes BIGINT',
  "ALTER TABLE vault_manifest ADD COLUMN IF NOT EXISTS content_type TEXT NOT NULL DEFAULT 'text/markdown; charset=utf-8'",
  'ALTER TABLE vault_manifest ADD COLUMN IF NOT EXISTS doc_id UUID NOT NULL DEFAULT gen_random_uuid()',
  "ALTER TABLE vault_manifest ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'",
  "ALTER TABLE vault_manifest ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'md'",
  'ALTER TABLE vault_manifest ADD COLUMN IF NOT EXISTS indexed_hash TEXT',
  'ALTER TABLE vault_manifest ADD COLUMN IF NOT EXISTS derived_key TEXT',
  'ALTER TABLE vault_manifest ADD COLUMN IF NOT EXISTS last_error TEXT',
  'CREATE UNIQUE INDEX IF NOT EXISTS vault_manifest_doc_id_uq ON vault_manifest(doc_id)',
  "CREATE INDEX IF NOT EXISTS idx_vault_manifest_status ON vault_manifest(status) WHERE status <> 'active'",
];

/** Explicit column list: never `SELECT *` (the legacy `content` column can be large). */
export const VAULT_COLUMNS = `file_path, doc_id, hash, object_key, chunk_ids, indexed, indexed_hash, status, source_type,
  content_type, size_bytes, last_error, updated_at, folder_path, depth`;
