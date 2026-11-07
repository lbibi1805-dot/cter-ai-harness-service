import type { VaultServiceOptions } from '../interfaces/vault.interface';

export const DEFAULT_VAULT_SERVICE_OPTIONS: VaultServiceOptions = {
  orphanGraceMs: 10 * 60 * 1000,
  deleteConcurrency: 4,
  now: Date.now,
};

/** Custom object metadata written with every vault object. */
export const VAULT_OBJECT_METADATA = {
  DOC_ID: 'doc-id',
  CONTENT_HASH: 'content-hash',
} as const;
