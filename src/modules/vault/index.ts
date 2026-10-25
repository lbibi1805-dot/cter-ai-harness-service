import * as path from 'path';
import { Router } from '../../shared/http/router';
import type { RetrievalModule } from '../retrieval';
import { VaultService } from './application/vault.service';
import { VaultIndexingService } from './application/vaultIndexing.service';
import type { VaultRepository } from './domain';
import { DiskVaultDocumentStore } from './infrastructure/diskVaultDocumentStore.adapter';
import { RetrievalVectorIndex } from './infrastructure/retrievalVectorIndex.adapter';
import { createVaultRepository } from './infrastructure/vaultRepository.factory';
import { VaultController } from './presentation/vault.controller';
import { createVaultRoutes } from './presentation/vault.routes';
import { DatabaseSettings } from '../../shared/database/interfaces/database.interface';

export interface VaultModuleConfig {
  database: DatabaseSettings;
  /** Folder holding raw markdown copies of uploaded files. */
  vaultPath: string;
  adminToken?: string;
}

export interface VaultModuleDeps {
  /** Null when Pinecone is not configured: files are stored but never indexed. */
  retrieval: RetrievalModule | null;
  /** Test hook. */
  repository?: VaultRepository;
}

export interface VaultModule {
  repository: VaultRepository;
  service: VaultService;
  indexing: VaultIndexingService;
  router: Router;
}

/** Wires the vault module: repository → services → controller → routes. */
export function createVaultModule(config: VaultModuleConfig, deps: VaultModuleDeps): VaultModule {
  const repository = deps.repository ?? createVaultRepository(config.database);
  const { retrieval } = deps;
  const vectors = retrieval ? new RetrievalVectorIndex(retrieval.vectorStore) : null;
  const documents = new DiskVaultDocumentStore(path.resolve(process.cwd(), config.vaultPath));

  const indexing = new VaultIndexingService(retrieval ? () => retrieval.createIndexer(repository) : null);
  const service = new VaultService(repository, vectors, documents, indexing);
  const router = new Router(createVaultRoutes(new VaultController(service, indexing)), config.adminToken);
  return { repository, service, indexing, router };
}

export * from './domain';
export { FileVaultRepository } from './infrastructure/fileVault.repository';
export { createVaultRepository } from './infrastructure/vaultRepository.factory';
export { RECONCILE_ALL_VECTORS_DELETED } from './application/constants/vault.constants';
export { VAULT_API_PREFIX } from './presentation/constants/vault.constants';
