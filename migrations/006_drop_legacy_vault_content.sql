-- 006: MANUAL, run only AFTER `npm run vault:reset -- --confirm` and the re-upload (handoff step).
-- Vault content now lives in object storage; the legacy inline column only wastes Neon storage.
-- Not applied by SchemaGuard on purpose: dropping it on deploy would destroy data before the reset.
ALTER TABLE vault_manifest DROP COLUMN IF EXISTS content;
