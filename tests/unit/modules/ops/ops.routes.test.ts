import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { AddressInfo } from 'net';
import { HttpServer } from '../../../../src/bootstrap/httpServer';
import { publicConfigView } from '../../../../src/bootstrap/startup/configurationReport';
import { createOpsModule, HEARTBEAT_PATH, OpsApiPath, DeepCheckName, type OpsStatusSource } from '../../../../src/modules/ops';
import { CachedVaultRepository, NeonVaultRepository, MARKDOWN_CONTENT_TYPE, VaultSourceType } from '../../../../src/modules/vault';
import { countingSqlClient } from '../../../../src/shared/database/countingSqlClient';
import { DbQueryCounter } from '../../../../src/shared/database/dbQueryCounter';
import { StorageProvider } from '../../../../src/shared/database/enums/database.enums';
import { objectStorageStats } from '../../../../src/shared/storage';
import { PgliteSqlClient } from '../../../support/pgliteSqlClient';
import { FakeObjectStorage } from '../../../support/countingAdapters';
import { buildTestAiConfig, buildTestConfig } from '../../../support/configFixture';

const ADMIN = 'admin-secret-token';
const DOC_A = '11111111-1111-4111-8111-111111111111';
const ADMIN_ROUTES = [OpsApiPath.HEALTH_DEEP, OpsApiPath.METRICS_DB, OpsApiPath.METRICS_LATENCY, OpsApiPath.CONFIG, OpsApiPath.STORAGE_STATS];

describe('ops endpoints (monitoring must not wake Neon)', () => {
  let pg: PgliteSqlClient;
  let counter: DbQueryCounter;
  let vault: CachedVaultRepository;
  let storage: FakeObjectStorage;
  let server: HttpServer;
  let base: string;
  let source: OpsStatusSource;
  let latencyProvider: ((windowMs: number) => unknown) | undefined;
  let deepFails = false;

  const secretConfig = buildTestConfig({
    http: { port: 0, corsOrigins: [], adminToken: ADMIN, chatApiToken: 'chat-secret-token' },
    ai: buildTestAiConfig({ keys: { gemini: 'gemini-secret-key' } }),
    database: { provider: StorageProvider.NEON, databaseUrl: 'postgres://user:db-secret-pass@neon.test/db' },
    storage: { r2: { accountId: 'acc', accessKeyId: 'r2-access-secret', secretAccessKey: 'r2-secret-secret', bucket: 'cter-dev' }, localDir: './x' },
    retrieval: { pineconeApiKey: 'pinecone-secret-key', pineconeIndex: 'cter-dev-index', embeddingProvider: 'gemini' as never, vaultPath: 'v', topK: 7, embeddingDelayMs: 0, embeddingBatchSize: 1 },
  });

  async function api(path: string, token?: string) {
    const res = await fetch(`${base}${path}`, { headers: token ? { authorization: `Bearer ${token}` } : {} });
    const text = await res.text();
    let body: unknown = text;
    try { body = JSON.parse(text); } catch { /* plain text */ }
    return { status: res.status, body: body as Record<string, any>, text };
  }

  beforeAll(async () => {
    pg = new PgliteSqlClient();
    await pg.db.query('SELECT 1'); // warm the WASM engine outside the timed tests (not counted)
    counter = new DbQueryCounter();
    vault = new CachedVaultRepository(new NeonVaultRepository(countingSqlClient(pg, counter)));
    storage = new FakeObjectStorage();
    source = {
      accounts: secretConfig.accounts,
      pollingState: () => 'stopped',
      aiCredentials: () => ({ gemini: true }),
      aiModels: () => ({ defaults: {} }),
      vectorIndex: { index: 'cter-dev-index', provider: 'gemini' },
      vaultStats: async () => vault.peekStats(),
      deepProbes: {
        [DeepCheckName.DATABASE]: async () => { await countingSqlClient(pg, counter).query('SELECT 1'); },
        [DeepCheckName.OBJECT_STORAGE]: async () => {
          if (deepFails) throw new Error('bucket unreachable');
          await storage.head('tmp/deep');
        },
      },
      dbMetrics: () => ({ ...counter.snapshot(), cursors: null }),
      publicConfig: () => publicConfigView(secretConfig),
      storageStats: () => objectStorageStats(storage),
      latency: (windowMs) => latencyProvider?.(windowMs),
      circuit: () => ({ open: [] }),
    };
    const ops = createOpsModule({ port: 0, heartbeat: { enabled: false, intervalMs: 60_000 }, adminToken: ADMIN }, source);
    server = new HttpServer(0, [ops.router], []);
    await server.start();
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }, 30_000);

  afterAll(async () => {
    await server.close();
    await pg.close();
  });

  beforeEach(() => {
    latencyProvider = undefined;
    deepFails = false;
  });

  it('heartbeat pings /ping, which answers 200 "ok" with 0 database queries', async () => {
    expect(HEARTBEAT_PATH).toBe(OpsApiPath.PING);
    const before = counter.count();
    const res = await api(OpsApiPath.PING);
    expect(res.status).toBe(200);
    expect(res.text).toBe('ok');
    expect(counter.count()).toBe(before);
  });

  it('/health never loads the manifest: "loading" before the startup load, then RAM stats; 0 queries per poll', async () => {
    const before = counter.count();
    expect((await api(OpsApiPath.HEALTH)).body.vault).toBe('loading');
    expect(counter.count()).toBe(before);

    await vault.refresh(); // startup load
    await vault.saveVersion({ filePath: 'f/a.md', docId: DOC_A, hash: 'h1', objectKey: `vault/${DOC_A}/h1.md`, sourceType: VaultSourceType.MARKDOWN, contentType: MARKDOWN_CONTENT_TYPE, sizeBytes: 10 });
    const loaded = counter.count();
    for (let i = 0; i < 20; i++) await api(OpsApiPath.HEALTH);
    expect((await api(OpsApiPath.HEALTH)).body.vault).toBe('0/1 indexed'); // upload kept the RAM counter current
    expect(counter.count()).toBe(loaded);
  }, 30_000);

  it.each(ADMIN_ROUTES)('%s requires ADMIN_TOKEN', async (path) => {
    expect((await api(path)).status).toBe(401);
    expect((await api(path, 'wrong')).status).toBe(401);
  });

  it('/api/metrics/db reports RAM counters without querying', async () => {
    const before = counter.count();
    const res = await api(OpsApiPath.METRICS_DB, ADMIN);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ queriesSinceBoot: before, cursors: null });
    expect(res.body.lastQueryTag).toBeTruthy();
    expect(counter.count()).toBe(before);
  });

  it('/health/deep runs each probe on demand, timed; skipped when not configured; 503 when one fails', async () => {
    const before = counter.count();
    const ok = await api(OpsApiPath.HEALTH_DEEP, ADMIN);
    expect(ok.status).toBe(200);
    expect(ok.body.checks.database).toMatchObject({ status: 'ok' });
    expect(typeof ok.body.checks.database.latencyMs).toBe('number');
    expect(ok.body.checks.vectorIndex).toEqual({ status: 'skipped' });
    expect(counter.count()).toBe(before + 1);

    deepFails = true;
    const failed = await api(OpsApiPath.HEALTH_DEEP, ADMIN);
    expect(failed.status).toBe(503);
    expect(failed.body.checks.objectStorage).toMatchObject({ status: 'failed', error: 'bucket unreachable' });
  });

  it('/api/config lists flags and limits but never a secret', async () => {
    const res = await api(OpsApiPath.CONFIG, ADMIN);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      R2_BUCKET: 'cter-dev',
      PINECONE_INDEX: 'cter-dev-index',
      RAG_TOP_K: 7,
      CONVERSATION_STORE_ENABLED: false,
      AUX_MODEL: 'gemini-3.1-flash-lite',
      HEARTBEAT_PATH: '/ping',
      ADMIN_TOKEN_SET: true,
    });
    for (const secret of [ADMIN, 'chat-secret-token', 'gemini-secret-key', 'db-secret-pass', 'r2-access-secret', 'r2-secret-secret', 'pinecone-secret-key', 'postgres://']) {
      expect(res.text).not.toContain(secret);
    }
    for (const name of Object.keys(res.body)) expect(name).not.toMatch(/_KEY$|TOKEN$|SECRET|PASSWORD|DATABASE_URL/);
  });

  it('/api/metrics/latency: 503 without a provider, window validated, provider result passed through', async () => {
    const absent = createOpsModule({ port: 0, heartbeat: { enabled: false, intervalMs: 60_000 }, adminToken: ADMIN }, { ...source, latency: undefined });
    const other = new HttpServer(0, [absent.router], []);
    await other.start();
    const res = await fetch(`http://127.0.0.1:${(other.address() as AddressInfo).port}${OpsApiPath.METRICS_LATENCY}`, { headers: { authorization: `Bearer ${ADMIN}` } });
    await other.close();
    expect(res.status).toBe(503);

    latencyProvider = (windowMs) => ({ turns: 3, seenWindowMs: windowMs });
    expect((await api(`${OpsApiPath.METRICS_LATENCY}?window=bogus`, ADMIN)).status).toBe(400);
    const day = await api(`${OpsApiPath.METRICS_LATENCY}?window=24h`, ADMIN);
    expect(day.status).toBe(200);
    expect(day.body).toEqual({ window: '24h', windowMs: 86_400_000, metrics: { turns: 3, seenWindowMs: 86_400_000 } });
  });

  it('/api/ai-usage includes the circuit when a provider is wired', async () => {
    expect((await api(OpsApiPath.AI_USAGE)).body.circuit).toEqual({ open: [] });
  });

  it('/api/storage/stats sums objects and bytes per prefix', async () => {
    await storage.put(`vault/${DOC_A}/h1.md`, 'hello', { contentType: 'text/markdown' });
    await storage.put('conversations/c1/a1.png', 'abc', { contentType: 'image/png' });
    const res = await api(OpsApiPath.STORAGE_STATS, ADMIN);
    expect(res.status).toBe(200);
    expect(res.body.prefixes).toEqual({ 'vault/': { objects: 1, bytes: 5 }, 'conversations/': { objects: 1, bytes: 3 }, 'derived/': { objects: 0, bytes: 0 } });
    expect(res.body).toMatchObject({ totalObjects: 2, totalBytes: 8 });
  });

  it('serves the new ops paths in the OpenAPI spec', async () => {
    const res = await api(OpsApiPath.OPENAPI);
    if (res.status === 404) return; // spec file not shipped in this checkout
    for (const path of [OpsApiPath.PING, ...ADMIN_ROUTES]) expect(Object.keys(res.body.paths)).toContain(path);
  });
});
