import { Router } from '../../shared/http/router';
import type { ObjectStorage } from '../../shared/storage';
import type { RetrievalModule } from '../retrieval';
import type { ReconcileReport } from './application/interfaces/vault.interface';
import { VaultService } from './application/vault.service';
import { createVaultChunkGuard } from './application/vaultChunkGuard';
import { createVaultLexicalCorpus } from './application/vaultLexicalCorpus';
import { VaultIndexingService } from './application/vaultIndexing.service';
import type { VaultDocumentReader, VaultRepository } from './domain';
import { CachedVaultRepository } from './infrastructure/cachedVault.repository';
import { RetrievalVectorIndex } from './infrastructure/retrievalVectorIndex.adapter';
import { createVaultRepository } from './infrastructure/vaultRepository.factory';
import { VaultController } from './presentation/vault.controller';
import { createVaultRoutes } from './presentation/vault.routes';
import { DatabaseSettings } from '../../shared/database/interfaces/database.interface';

export interface VaultModuleConfig {
  database: DatabaseSettings;
  adminToken?: string;
}

export interface VaultModuleDeps {
  /** Null when Pinecone is not configured: files are stored but never indexed. */
  retrieval: RetrievalModule | null;
  /** Where file bytes live (R2 in prod). */
  storage: ObjectStorage;
  /** Test hook (wrapped in the RAM cache like the real one). */
  repository?: VaultRepository;
}

export interface VaultModule {
  /** The cached manifest: reads cost no database query after the first load. */
  repository: CachedVaultRepository;
  service: VaultService;
  indexing: VaultIndexingService;
  documents: VaultDocumentReader;
  router: Router;
  /** Reload the manifest, then garbage-collect (serialized with indexing runs). */
  reconcile(): Promise<ReconcileReport>;
}

/** Wires the vault module: repository (+RAM cache) → services → controller → routes; installs the RAG guard. */
export function createVaultModule(config: VaultModuleConfig, deps: VaultModuleDeps): VaultModule {
  const repository = new CachedVaultRepository(deps.repository ?? createVaultRepository(config.database));
  const { retrieval, storage } = deps;
  const vectors = retrieval ? new RetrievalVectorIndex(retrieval.vectorStore) : null;

  let service: VaultService | null = null;
  const indexing = new VaultIndexingService(retrieval ? () => retrieval.createIndexer(repository, service!.documents) : null);
  service = new VaultService(repository, vectors, storage, indexing);
  retrieval?.setChunkGuard(createVaultChunkGuard(repository));
  retrieval?.lexical?.setCorpus(createVaultLexicalCorpus(repository, service.documents));

  const vaultService = service;
  const reconcile = (): Promise<ReconcileReport> => indexing.runExclusive(async () => {
    await repository.refresh();
    return vaultService.reconcile();
  });
  const router = new Router(createVaultRoutes(new VaultController(vaultService, indexing, reconcile)), config.adminToken);
  return { repository, service: vaultService, indexing, documents: vaultService.documents, router, reconcile };
}

export * from './domain';
export type { ReconcileReport, VaultUploadResult, VaultFileView } from './application/interfaces/vault.interface';
export { VaultService } from './application/vault.service';
export { createVaultChunkGuard } from './application/vaultChunkGuard';
export { createVaultLexicalCorpus } from './application/vaultLexicalCorpus';
export { FileVaultRepository } from './infrastructure/fileVault.repository';
export { InMemoryVaultRepository } from './infrastructure/inMemoryVault.repository';
export { NeonVaultRepository } from './infrastructure/neonVault.repository';
export { CachedVaultRepository } from './infrastructure/cachedVault.repository';
export { createVaultRepository } from './infrastructure/vaultRepository.factory';
export { VAULT_API_PREFIX } from './presentation/constants/vault.constants';
