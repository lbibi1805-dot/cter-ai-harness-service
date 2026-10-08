import { neon } from '@neondatabase/serverless';
import { logger } from '../../../utils/logger';
import { VaultStorageProvider, type VaultRepository } from '../domain';
import { FileVaultRepository } from './fileVault.repository';
import { NeonVaultRepository } from './neonVault.repository';

export interface VaultStorageSettings {
  provider: VaultStorageProvider;
  databaseUrl?: string;
}

export function parseVaultStorageProvider(value: string | undefined): VaultStorageProvider {
  return value === VaultStorageProvider.NEON ? VaultStorageProvider.NEON : VaultStorageProvider.FILE;
}

/** Neon when configured with a URL; otherwise the local JSON manifest. */
export function createVaultRepository(settings: VaultStorageSettings): VaultRepository {
  if (settings.provider !== VaultStorageProvider.NEON) return new FileVaultRepository();
  if (!settings.databaseUrl) {
    logger.info(`[vault] DATABASE_URL missing for ${VaultStorageProvider.NEON}, falling back to ${VaultStorageProvider.FILE}`);
    return new FileVaultRepository();
  }
  return new NeonVaultRepository(neon(settings.databaseUrl));
}
