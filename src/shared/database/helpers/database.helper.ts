import { neon } from '@neondatabase/serverless';
import { StorageProvider } from '../enums/database.enums';
import { DatabaseSettings, NeonSql } from '../interfaces/database.interface';

export function parseStorageProvider(value: string | undefined): StorageProvider {
  return value === StorageProvider.NEON ? StorageProvider.NEON : StorageProvider.FILE;
}

/** True when Neon is selected and reachable by URL; otherwise callers use the file store. */
export function usesNeon(settings: DatabaseSettings): settings is DatabaseSettings & { databaseUrl: string } {
  return settings.provider === StorageProvider.NEON && !!settings.databaseUrl;
}

const clients = new Map<string, NeonSql>();

/** One HTTP client per connection string, shared by every repository. */
export function getNeonSql(databaseUrl: string): NeonSql {
  let client = clients.get(databaseUrl);
  if (!client) {
    client = neon(databaseUrl);
    clients.set(databaseUrl, client);
  }
  return client;
}
