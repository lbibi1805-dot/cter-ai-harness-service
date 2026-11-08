import { Pinecone } from '@pinecone-database/pinecone';
import { AI_PROVIDERS, ModelRoute, perProvider, type AiModule } from '../../modules/ai';
import { DeepCheckName, type DeepProbe, type OpsStatusSource } from '../../modules/ops';
import type { PollingModule } from '../../modules/polling';
import type { VaultModule } from '../../modules/vault';
import { dbQueryCounter, type DbQueryCounter } from '../../shared/database/dbQueryCounter';
import { getNeonSql, usesNeon } from '../../shared/database/helpers/database.helper';
import { neonSqlClient } from '../../shared/database/neonSqlClient';
import { ObjectPrefix, objectStorageStats, probeObjectStorage, type ObjectStorage } from '../../shared/storage';
import type { AppConfig } from '../interfaces/appConfig.interface';
import { publicConfigView } from './configurationReport';

/** `GET /health/deep` database probe: the cheapest statement that proves Neon answers. */
const DEEP_DATABASE_SQL = 'SELECT 1 AS ok';
/** HEAD of a key that never exists: one Class B operation proves the bucket and credentials answer. */
const DEEP_STORAGE_KEY = `${ObjectPrefix.TMP}deep-health-check`;

/** Optional live providers the lead wires from other modules (latency ring buffer, circuit breaker). */
export interface OpsStatusExtras {
  latency?: (windowMs: number) => unknown;
  circuit?: () => unknown;
  prompts?: () => unknown;
  evals?: () => unknown;
  /** Defaults to the process-wide counter every Neon client reports to. */
  dbCounter?: DbQueryCounter;
}

/** Real round-trips, built lazily: nothing here runs unless `GET /health/deep` is called. */
function buildDeepProbes(config: AppConfig, storage?: ObjectStorage): Partial<Record<DeepCheckName, DeepProbe>> {
  const probes: Partial<Record<DeepCheckName, DeepProbe>> = {};
  const database = config.database;
  if (usesNeon(database)) {
    probes[DeepCheckName.DATABASE] = async () => {
      await neonSqlClient(getNeonSql(database.databaseUrl)).query(DEEP_DATABASE_SQL);
      return { provider: database.provider };
    };
  }
  if (storage) {
    probes[DeepCheckName.OBJECT_STORAGE] = async () => {
      await storage.head(DEEP_STORAGE_KEY);
      return { kind: storage.kind, location: storage.location };
    };
  }
  const retrieval = config.retrieval;
  if (retrieval) {
    probes[DeepCheckName.VECTOR_INDEX] = async () => {
      const stats = await new Pinecone({ apiKey: retrieval.pineconeApiKey }).index(retrieval.pineconeIndex).describeIndexStats();
      return { index: retrieval.pineconeIndex, totalRecordCount: stats.totalRecordCount ?? null, dimension: stats.dimension ?? null };
    };
  }
  return probes;
}

/** What `/`, `/health` and the ops/metrics endpoints report, read live from the running modules. */
export function buildOpsStatusSource(
  config: AppConfig,
  ai: AiModule,
  polling: PollingModule,
  vault: VaultModule,
  storage?: ObjectStorage,
  extras: OpsStatusExtras = {},
): OpsStatusSource {
  const counter = extras.dbCounter ?? dbQueryCounter;
  return {
    accounts: config.accounts,
    pollingState: () => polling.scheduler.status().state,
    aiCredentials: () => perProvider((provider) => ai.configuredAdapters.isConfigured(provider)),
    aiModels: () => ({
      /** Backend view of each provider's chain: direct models, then the OpenRouter fallback. */
      providers: Object.fromEntries(AI_PROVIDERS.map((provider) => {
        const fallback = ai.catalog.openRouterFallback(provider);
        const direct = ai.adapters.direct(provider) ? ai.catalog.chainFor(provider, ai.catalog.defaultModel(provider)) : [];
        return [provider, fallback ? [...direct, `${ModelRoute.OPENROUTER}:${fallback}`] : direct];
      })),
      defaults: perProvider((provider) => ai.catalog.defaultModel(provider)),
    }),
    vectorIndex: config.retrieval ? { index: config.retrieval.pineconeIndex, provider: config.retrieval.embeddingProvider } : null,
    // RAM only: `/health` is polled every few seconds and must never wake Neon.
    vaultStats: async () => vault.repository.peekStats(),
    deepProbes: buildDeepProbes(config, storage),
    dbMetrics: () => ({ ...counter.snapshot(), cursors: polling.cursorCache?.stats() ?? null }),
    publicConfig: () => publicConfigView(config),
    ...(storage ? { probeStorage: () => probeObjectStorage(storage), storageStats: () => objectStorageStats(storage) } : {}),
    ...(extras.latency ? { latency: extras.latency } : {}),
    ...(extras.circuit ? { circuit: extras.circuit } : {}),
    ...(extras.prompts ? { prompts: extras.prompts } : {}),
    ...(extras.evals ? { evals: extras.evals } : {}),
  };
}
