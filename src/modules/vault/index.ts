import * as path from 'path';
import { VectorStore } from '../../rag/vectorStore';
import { Router } from '../../shared/http/router';
import type { AppConfig } from '../../types';
import { VaultService } from './application/vault.service';
import { VaultIndexingService } from './application/vaultIndexing.service';
import type { VaultRepository } from './domain';
import { DiskVaultDocumentStore } from './infrastructure/diskVaultDocumentStore';
import { createKnowledgeIndexerFactory } from './infrastructure/knowledgeVaultIndexer';
import { PineconeVectorIndex } from './infrastructure/pineconeVectorIndex';
import { createVaultRepository } from './infrastructure/vaultRepository.factory';
import { VaultController } from './presentation/vault.controller';
import { createVaultRoutes } from './presentation/vault.routes';

export const DEFAULT_VAULT_PATH = './documents-vault';

export interface VaultModule {
  repository: VaultRepository;
  service: VaultService;
  indexing: VaultIndexingService;
  router: Router;
}

/** Wires the vault module: repository → services → controller → routes. */
export function createVaultModule(config: AppConfig): VaultModule {
  const repository = createVaultRepository(config.database);
  const vectors = config.vaultConfig
    ? new PineconeVectorIndex(new VectorStore(config.vaultConfig.pineconeApiKey, config.vaultConfig.pineconeIndex))
    : null;
  const documents = new DiskVaultDocumentStore(
    path.resolve(process.cwd(), config.vaultConfig?.vaultPath ?? DEFAULT_VAULT_PATH),
  );

  const service = new VaultService(repository, vectors, documents);
  const indexing = new VaultIndexingService(createKnowledgeIndexerFactory(config, repository));
  const router = new Router(createVaultRoutes(new VaultController(service, indexing)), config.adminToken);
  return { repository, service, indexing, router };
}

export { VAULT_API_PREFIX } from './presentation/vault.routes';
export { RECONCILE_ALL_VECTORS_DELETED } from './application/vault.service';
export { createVaultRepository } from './infrastructure/vaultRepository.factory';
export * from './domain';
