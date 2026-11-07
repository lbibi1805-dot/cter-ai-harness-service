-- 005: server-side conversations (planning-06112026/03-conversation-store.md, 13 §4 soft delete).
-- Applied automatically at startup by SchemaGuard (conversationSchema.constants.ts). Idempotent.
-- Files (user images, C4 PNG/PUML) live in object storage under conversations/<id>/.
BEGIN;
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY,
  title TEXT,
  summary TEXT,                                   -- rolling auto-compact summary (note 04)
  summary_upto_seq INT NOT NULL DEFAULT 0,
  state JSONB NOT NULL DEFAULT '{}'::jsonb,       -- pending workflows, e.g. {"pendingC4": {...}}
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,                         -- soft delete
  purge_after TIMESTAMPTZ                         -- deleted_at + CONVERSATION_PURGE_DAYS
);
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  seq INT NOT NULL,
  role TEXT NOT NULL,                             -- user | assistant
  kind TEXT NOT NULL DEFAULT 'chat',              -- chat | c4 | c4_review | summary
  text TEXT NOT NULL DEFAULT '',
  provider TEXT, model TEXT, mode TEXT, prompt_version TEXT,
  tokens_in INT, tokens_out INT, ttft_ms INT, latency_ms INT,
  sources JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, seq)
);
CREATE TABLE IF NOT EXISTS artifacts (
  id UUID PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  ordinal INT NOT NULL DEFAULT 0,                 -- [A{ordinal}] alias shown to the model
  kind TEXT NOT NULL,                             -- user_image | c4_png | c4_puml | c4_spec | problem_brief | design_review
  object_key TEXT, mime TEXT, sha256 TEXT, size_bytes BIGINT,
  caption TEXT, ocr_text TEXT,                    -- written by the aux model (note 04)
  data_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS artifacts_conversation_idx ON artifacts (conversation_id, ordinal);
CREATE INDEX IF NOT EXISTS conversations_active_updated_idx ON conversations (updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS conversations_purge_idx ON conversations (purge_after) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS conversations_pending_c4_idx ON conversations ((state->'pendingC4'->>'id')) WHERE state ? 'pendingC4';
COMMIT;
