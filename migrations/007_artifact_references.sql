-- 007: artifact reference resolution (planning-06112026/17 §4) + prompt-cache metrics (18 §5 step 1).
-- Applied automatically at startup by SchemaGuard (conversationSchema.constants.ts). Idempotent, additive only.
BEGIN;
ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS label TEXT;                -- "C4 container · Hệ thống đặt vé · v2" (generated on write, no LLM)
ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS level TEXT;                -- C4 level, '+'-joined for a multi-level spec; NULL = not a diagram
ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS owner TEXT;                -- user | assistant
ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS parent_artifact_id UUID REFERENCES artifacts(id) ON DELETE SET NULL; -- version chain
ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS resolved_refs JSONB;        -- {ids, source: ui|rule|aux|ambiguous|none, scores}
ALTER TABLE messages ADD COLUMN IF NOT EXISTS tokens_cached INT;          -- prompt tokens served from the provider cache
CREATE INDEX IF NOT EXISTS artifacts_conversation_kind_idx ON artifacts (conversation_id, kind, ordinal);
COMMIT;
