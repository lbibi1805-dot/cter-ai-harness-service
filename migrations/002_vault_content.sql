-- Neon-only vault: persist file content in DB so Render ephemeral disk can be ignored
ALTER TABLE vault_manifest ADD COLUMN IF NOT EXISTS content TEXT NOT NULL DEFAULT '';
