import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import { StorageProvider } from './database.enums';

export type NeonSql = NeonQueryFunction<false, false>;

export interface DatabaseSettings {
  provider: StorageProvider;
  databaseUrl?: string;
}

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

/**
 * Applies idempotent DDL once per repository. A failed attempt is forgotten so
 * the next query retries instead of failing forever after a cold-start blip.
 */
export class SchemaGuard {
  private ready: Promise<void> | null = null;

  constructor(
    private readonly sql: NeonSql,
    private readonly statements: readonly string[],
  ) {}

  ensure(): Promise<void> {
    if (!this.ready) {
      this.ready = this.apply().catch((err) => {
        this.ready = null;
        throw err;
      });
    }
    return this.ready;
  }

  private async apply(): Promise<void> {
    for (const statement of this.statements) await this.sql.query(statement);
  }
}
