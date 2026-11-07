-- 004: vault files move to object storage (Cloudflare R2). The manifest keeps ids + sync state only.
-- Applied automatically at startup by SchemaGuard (vaultSchema.constants.ts); this file documents it
-- and can be run by hand. Idempotent.
-- Notes: planning-06112026/02-r2-object-storage.md, 12-r2-sync-best-practices.md
BEGIN;
ALTER TABLE vault_manifest ADD COLUMN IF NOT EXISTS object_key   TEXT NOT NULL DEFAULT '';        -- vault/{docId}/{contentHash}.md
ALTER TABLE vault_manifest ADD COLUMN IF NOT EXISTS size_bytes   BIGINT;
ALTER TABLE vault_manifest ADD COLUMN IF NOT EXISTS content_type TEXT NOT NULL DEFAULT 'text/markdown; charset=utf-8';
ALTER TABLE vault_manifest ADD COLUMN IF NOT EXISTS doc_id       UUID NOT NULL DEFAULT gen_random_uuid(); -- stable id, prefix of chunk ids
ALTER TABLE vault_manifest ADD COLUMN IF NOT EXISTS status       TEXT NOT NULL DEFAULT 'active';  -- active | indexing | deleting | failed
ALTER TABLE vault_manifest ADD COLUMN IF NOT EXISTS source_type  TEXT NOT NULL DEFAULT 'md';      -- md (pdf later, note 14)
ALTER TABLE vault_manifest ADD COLUMN IF NOT EXISTS indexed_hash TEXT;                            -- hash behind chunk_ids (live vectors)
ALTER TABLE vault_manifest ADD COLUMN IF NOT EXISTS derived_key  TEXT;                            -- derived/{docId}/{hash}/ (note 14)
ALTER TABLE vault_manifest ADD COLUMN IF NOT EXISTS last_error   TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS vault_manifest_doc_id_uq ON vault_manifest(doc_id);
CREATE INDEX IF NOT EXISTS idx_vault_manifest_status ON vault_manifest(status) WHERE status <> 'active';
COMMIT;
-- The legacy `content` column is NOT dropped here (see 006, run after the vault reset).
