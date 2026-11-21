import type { Router } from '../../../shared/http/router';
import type { ObjectStorage } from '../../../shared/storage';
import type { RetrievalModule } from '../../retrieval';
import type { ReconcileReport } from '../application/interfaces/vault.interface';
import type { VaultService } from '../application/vault.service';
import type { VaultIndexingService } from '../application/vaultIndexing.service';
import type { VaultDocumentReader, VaultRepository } from '../domain';
import type { CachedVaultRepository } from '../infrastructure/cachedVault.repository';
import type { DatabaseSettings } from '../../../shared/database/interfaces/database.interface';

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
