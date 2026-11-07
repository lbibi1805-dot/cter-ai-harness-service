export enum VaultApiPath {
  FILES = '/api/vault/files',
  FILE_PREFIX = '/api/vault/files/',
  CHUNKS_SUFFIX = '/chunks',
  RENAME_SUFFIX = '/rename',
  CHUNKS = '/api/vault/chunks',
  FOLDERS = '/api/vault/folders',
  MANIFEST = '/api/vault/manifest',
  REINDEX = '/api/vault/reindex',
  /** Legacy name kept for the monitoring UI. */
  SYNC_VECTORS = '/api/vault/sync-pinecone',
  SYNC = '/api/vault/sync',
}
