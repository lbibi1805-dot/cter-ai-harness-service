/**
 * Idempotent schema for server-side conversations (mirrors migrations/005 + 007 + 008 + 009).
 * Applied once per process as one transaction. Files live on object storage
 * under `conversations/<id>/`; rows only keep ids, text and metadata.
 */
export const CONVERSATION_SCHEMA_STATEMENTS: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY,
    title TEXT,
    summary TEXT,
    summary_upto_seq INT NOT NULL DEFAULT 0,
    state JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    purge_after TIMESTAMPTZ
  )`,
  `CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    seq INT NOT NULL,
    role TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'chat',
    text TEXT NOT NULL DEFAULT '',
    provider TEXT,
    model TEXT,
    mode TEXT,
    prompt_version TEXT,
    tokens_in INT,
    tokens_out INT,
    ttft_ms INT,
    latency_ms INT,
    sources JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (conversation_id, seq)
  )`,
  `CREATE TABLE IF NOT EXISTS artifacts (
    id UUID PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    ordinal INT NOT NULL DEFAULT 0,
    kind TEXT NOT NULL,
    object_key TEXT,
    mime TEXT,
    sha256 TEXT,
    size_bytes BIGINT,
    caption TEXT,
    ocr_text TEXT,
    data_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  'CREATE INDEX IF NOT EXISTS artifacts_conversation_idx ON artifacts (conversation_id, ordinal)',
  'CREATE INDEX IF NOT EXISTS conversations_active_updated_idx ON conversations (updated_at DESC) WHERE deleted_at IS NULL',
  'CREATE INDEX IF NOT EXISTS conversations_purge_idx ON conversations (purge_after) WHERE deleted_at IS NOT NULL',
  "CREATE INDEX IF NOT EXISTS conversations_pending_c4_idx ON conversations ((state->'pendingC4'->>'id')) WHERE state ? 'pendingC4'",
  // 007: artifact reference resolution (note 17) + prompt-cache metrics (note 18). Additive, idempotent.
  'ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS label TEXT',
  'ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS level TEXT',
  'ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS owner TEXT',
  'ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS parent_artifact_id UUID REFERENCES artifacts(id) ON DELETE SET NULL',
  'ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1',
  'ALTER TABLE messages ADD COLUMN IF NOT EXISTS resolved_refs JSONB',
  'ALTER TABLE messages ADD COLUMN IF NOT EXISTS tokens_cached INT',
  'CREATE INDEX IF NOT EXISTS artifacts_conversation_kind_idx ON artifacts (conversation_id, kind, ordinal)',
  // 008: C4 agent flow (note 05): intent router decision per C4 message. Additive, idempotent.
  'ALTER TABLE messages ADD COLUMN IF NOT EXISTS intent TEXT',
  'ALTER TABLE messages ADD COLUMN IF NOT EXISTS intent_confidence REAL',
  // 009: rename (user title, kept apart from the generated one) + keyset list paging (planning-12112026/07). Additive, idempotent.
  'ALTER TABLE conversations ADD COLUMN IF NOT EXISTS display_title TEXT',
  'CREATE INDEX IF NOT EXISTS conversations_active_updated_id_idx ON conversations (updated_at DESC, id DESC) WHERE deleted_at IS NULL',
];
