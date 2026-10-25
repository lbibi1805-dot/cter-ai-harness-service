import { type NeonQueryFunction } from '@neondatabase/serverless';
import { StorageProvider } from '../enums/database.enums';

export type NeonSql = NeonQueryFunction<false, false>;

export interface DatabaseSettings {
  provider: StorageProvider;
  databaseUrl?: string;
}
