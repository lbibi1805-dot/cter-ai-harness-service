-- 009: lazy history + rename (planning-12112026/07 §3 Bước 1-2).
-- Applied automatically at startup by SchemaGuard (conversationSchema.constants.ts). Idempotent, additive only.
-- display_title: name given by the user (PATCH /api/conversations/:id). NULL = show the generated `title`
--   (first question); the generated title is never overwritten so "restore original name" = set NULL.
-- conversations_active_updated_id_idx: keyset paging of GET /api/conversations (ORDER BY updated_at DESC, id DESC).
--   conversations_active_updated_idx (005) is kept; it is a prefix of this one and can be dropped later.
BEGIN;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS display_title TEXT;
CREATE INDEX IF NOT EXISTS conversations_active_updated_id_idx ON conversations (updated_at DESC, id DESC) WHERE deleted_at IS NULL;
COMMIT;
