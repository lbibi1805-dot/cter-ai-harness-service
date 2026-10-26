import type { AppConfig } from '../../src/bootstrap/interfaces/appConfig.interface';
import { StorageProvider } from '../../src/shared/database/enums/database.enums';
import { AIProvider, OPENROUTER_DEFAULT_BASE_URL, type AiConfig, type PerProvider } from '../../src/modules/ai';
import { DEFAULT_RERANK_CONFIG } from '../../src/modules/rerank/domain/constants/rerankConfig.constants';

const TEST_AI_TIMEOUT_MS = 5_000;
const TEST_POLL_INTERVAL_MS = 60_000;
const TEST_AGENT_MAX_DURATION_MS = 30_000;
const TEST_HEARTBEAT_INTERVAL_MS = 60_000;

export function perProvider<T>(value: (provider: AIProvider) => T): PerProvider<T> {
  return {
    [AIProvider.CLAUDE]: value(AIProvider.CLAUDE),
    [AIProvider.GEMINI]: value(AIProvider.GEMINI),
    [AIProvider.GROK]: value(AIProvider.GROK),
    [AIProvider.OPENAI]: value(AIProvider.OPENAI),
  };
}

/** AI settings with no keys, no direct fallbacks and OpenRouter off unless overridden. */
export function buildTestAiConfig(overrides: Partial<AiConfig> = {}): AiConfig {
  return {
    keys: {},
    defaultModels: perProvider((provider) => `${provider}-test`),
    modelFallback: perProvider(() => []),
    grokBaseUrl: '',
    timeoutMs: TEST_AI_TIMEOUT_MS,
    maxRetryCount: 1,
    openRouter: {
      baseUrl: OPENROUTER_DEFAULT_BASE_URL,
      models: perProvider((provider) => `vendor/${provider}-test`),
      fallbacks: perProvider(() => []),
      allowProviderFallbacks: true,
      maxTokens: 1024,
    },
    ...overrides,
  };
}

/**
 * A complete, valid `AppConfig` for tests. Callers override only the fields
 * the test cares about, so adding a config field never breaks every fixture.
 */
export function buildTestConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    http: { port: 0, corsOrigins: [] },
    accounts: [{ url: 'https://canvas.test', apiKey: 'token', index: 1 }],
    canvasFolders: { materials: 'Materials2', input: 'Q', output: 'A' },
    polling: { intervalMs: TEST_POLL_INTERVAL_MS, autostart: false },
    prompts: { systemPrompt: 'sys', knowledgeContent: '' },
    ai: buildTestAiConfig(),
    retrieval: null,
    rerank: { ...DEFAULT_RERANK_CONFIG },
    agent: { maxToolCalls: 4, minToolCalls: 1, maxDurationMs: TEST_AGENT_MAX_DURATION_MS },
    database: { provider: StorageProvider.FILE },
    gmail: {},
    heartbeat: { enabled: false, intervalMs: TEST_HEARTBEAT_INTERVAL_MS },
    ...overrides,
  };
}
