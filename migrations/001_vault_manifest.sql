-- Neon vault manifest with folder hierarchies for RAG
CREATE TABLE IF NOT EXISTS vault_manifest (
  file_path TEXT PRIMARY KEY CHECK (length(file_path) < 1024),
  hash TEXT NOT NULL,
  chunk_ids JSONB NOT NULL DEFAULT '[]',
  indexed BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  folder_path TEXT GENERATED ALWAYS AS (regexp_replace(file_path, '/[^/]+$', '')) STORED,
  depth INT GENERATED ALWAYS AS (length(file_path) - length(replace(file_path,'/',''))) STORED
);
CREATE INDEX IF NOT EXISTS idx_vault_manifest_indexed ON vault_manifest(indexed);
CREATE INDEX IF NOT EXISTS idx_vault_manifest_folder ON vault_manifest(folder_path);
CREATE INDEX IF NOT EXISTS idx_vault_manifest_depth ON vault_manifest(depth);
