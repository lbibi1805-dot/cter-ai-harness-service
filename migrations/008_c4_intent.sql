-- 008: C4 agent flow (planning-06112026/05 §2, monitoring 16 §3): intent router decision per C4 message.
-- Applied automatically at startup by SchemaGuard (conversationSchema.constants.ts). Idempotent, additive only.
-- The pending workflow (questions, step) lives in the existing conversations.state->'pendingC4' (JSONB, migration 005).
BEGIN;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS intent TEXT;               -- qa | c4_generate | c4_review | c4_generate_and_review | c4_revise
ALTER TABLE messages ADD COLUMN IF NOT EXISTS intent_confidence REAL;    -- 0..1 (router: rule / aux / explicit)
COMMIT;
