import { StorageProvider } from '../../../shared/database/enums/database.enums';
import { getNeonSql, usesNeon } from '../../../shared/database/helpers/database.helper';
import { DatabaseSettings } from '../../../shared/database/interfaces/database.interface';
import { neonSqlClient } from '../../../shared/database/neonSqlClient';
import { logger } from '../../../shared/logging/logger';
import type { VaultRepository } from '../domain';
import { FileVaultRepository } from './fileVault.repository';
import { NeonVaultRepository } from './neonVault.repository';

/** Neon when configured with a URL; otherwise the local JSON manifest. */
export function createVaultRepository(settings: DatabaseSettings): VaultRepository {
  if (usesNeon(settings)) return new NeonVaultRepository(neonSqlClient(getNeonSql(settings.databaseUrl)));
  if (settings.provider === StorageProvider.NEON) {
    logger.info(`[vault] DATABASE_URL missing for ${StorageProvider.NEON}, falling back to ${StorageProvider.FILE}`);
  }
  return new FileVaultRepository();
}
