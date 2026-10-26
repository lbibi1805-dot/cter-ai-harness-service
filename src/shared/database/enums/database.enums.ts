/** Persistence backend. Values match `VAULT_STORAGE_PROVIDER` for backward compatibility. */
export enum StorageProvider {
  FILE = 'sqlite-disk',
  NEON = 'postgres-r2',
}
