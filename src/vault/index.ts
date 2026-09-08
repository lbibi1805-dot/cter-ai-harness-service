export * from './VaultStorage';
export * from './SqliteVaultStorage';
export * from './PostgresVaultStorage';

import { VaultStorage } from './VaultStorage';
import { SqliteVaultStorage } from './SqliteVaultStorage';
import { NeonHttpVaultStorage } from './NeonHttpVaultStorage';

export function createVaultStorage(): VaultStorage {
  const provider = (process.env.VAULT_STORAGE_PROVIDER ?? 'sqlite-disk') as string;
  if (provider === 'postgres-r2') {
    if (!process.env.DATABASE_URL) {
      console.warn('[vault] DATABASE_URL missing for postgres-r2, fallback to sqlite-disk');
      return new SqliteVaultStorage();
    }
    return new NeonHttpVaultStorage();
  }
  return new SqliteVaultStorage();
}

let cachedStorage: VaultStorage | null = null;
let cachedProvider: string | null = null;

export async function createVaultStorageWithFallback(): Promise<VaultStorage> {
  const provider = process.env.VAULT_STORAGE_PROVIDER ?? 'sqlite-disk';
  if (cachedStorage && cachedProvider === provider) return cachedStorage;
  const storage = createVaultStorage();
  try {
    await storage.init();
    cachedStorage = storage;
    cachedProvider = provider;
    return storage;
  } catch (err) {
    const msg = (err as Error).message;
    const code = (err as any).code ?? '';
    // Khi VAULT_STORAGE_PROVIDER=postgres-r2 thì KHÔNG fallback, throw thẳng để dùng Neon luôn
    if (provider === 'postgres-r2') throw err;
    const isConnErr = msg.includes('ENOTFOUND') || msg.includes('getaddrinfo') || msg.includes('DATABASE_URL') || msg.includes('ECONNRESET') || msg.includes('ETIMEDOUT') || msg.includes('ECONNREFUSED') || code === 'ECONNRESET' || code === 'ENOTFOUND';
    if (isConnErr) {
      if (!cachedStorage) console.warn(`[vault] ${msg} — fallback to sqlite-disk (cached)`);
      const fallback = new SqliteVaultStorage();
      await fallback.init();
      cachedStorage = fallback;
      cachedProvider = 'sqlite-disk';
      return fallback;
    }
    throw err;
  }
}
