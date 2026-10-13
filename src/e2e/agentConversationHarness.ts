// Shared setup for the client ↔ backend connection tests: a fake Canvas, a fake
// OpenAI Responses endpoint, and the REAL ConversationPoller + agent module wired
// like src/index.ts. Only the AI providers are fake.
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { vi } from 'vitest';
import { AIInvocationService, PromptPreparer } from '../modules/ai';
import { createAgentModule } from '../modules/agent';
import { createOpenAIToolModelFactory } from '../modules/agent/infrastructure/openaiResponsesToolModel';
import { FileVaultRepository } from '../modules/vault/infrastructure/fileVault.repository';
import { ConversationPoller } from '../orchestrator/conversationPoller';
import { StorageProvider } from '../shared/database/database.enums';
import { StateManager } from '../state/stateManager';
import type { AIAdapter, AppConfig, CanvasAccountConfig } from '../types';
import { FakeCanvasServer } from './fakeCanvasServer';
import { FakeOpenAIResponsesServer } from './fakeOpenAIResponsesServer';

export const HARNESS_VAULT_DOC = 'mon-qnx-current/lab-4/Mutex-vs-Semaphore.md';
export const HARNESS_VAULT_TEXT = 'sem_wait blocks at zero.';
export const SINGLE_SHOT_ANSWER = 'single-shot answer';

export interface AgentConversationHarness {
  canvas: FakeCanvasServer;
  openai: FakeOpenAIResponsesServer;
  singleShot: ReturnType<typeof vi.fn>;
  account: () => CanvasAccountConfig;
  /** One backend poll round for the account (what each tick does for chat). */
  poll: () => Promise<void>;
  stop: () => Promise<void>;
}

export async function startAgentConversationHarness(): Promise<AgentConversationHarness> {
  const canvas = new FakeCanvasServer();
  const openai = new FakeOpenAIResponsesServer();
  await canvas.start();
  await openai.start();
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-conv-'));
  const account = (): CanvasAccountConfig => ({ url: canvas.baseUrl, apiKey: 'token', index: 1 });

  const vault = new FileVaultRepository(workDir);
  await vault.save({ filePath: HARNESS_VAULT_DOC, hash: 'h', chunkIds: [], indexed: true, content: `## Semaphore\n${HARNESS_VAULT_TEXT}` });

  const config = {
    accounts: [account()], aiKeys: { openai: 'k' },
    defaultModels: { claude: 'c', gemini: 'g', grok: 'x', openai: 'gpt-6-astra' },
    modelFallback: { claude: [], gemini: [], grok: [], openai: [] },
    pollIntervalMs: 1000, maxRetryCount: 0, systemPrompt: 'sys', knowledgeContent: '', grokBaseUrl: '',
    aiTimeoutMs: 5000, gmail: {}, canvasFolder: { materials: 'Materials2', input: 'Q', output: 'A' },
    database: { provider: StorageProvider.FILE }, pollAutostart: false, agent: { maxToolCalls: 4, minToolCalls: 1, maxDurationMs: 30_000 },
  } as AppConfig;

  const singleShot = vi.fn(async () => SINGLE_SHOT_ANSWER);
  const adapter: AIAdapter = { validate: async () => undefined, process: singleShot };
  const ai = new AIInvocationService(config, new PromptPreparer('sys', ''), { createAdapter: () => adapter, sleep: async () => undefined });
  const { answers } = createAgentModule(config, {
    ai,
    vaultRepository: vault,
    createModel: createOpenAIToolModelFactory({ apiKey: 'k', timeoutMs: 5000, baseURL: openai.baseURL, sleep: async () => undefined }),
    searcher: { search: async () => [{ chunkId: 'c', source: HARNESS_VAULT_DOC, heading: 'Semaphore', parentHeading: '', text: HARNESS_VAULT_TEXT, tokenCount: 5, score: 0.8 }] },
  });
  const state = new StateManager(path.join(workDir, 'processed.json'));
  state.load();
  const poller = new ConversationPoller(config, state, undefined, undefined, answers);

  return {
    canvas,
    openai,
    singleShot,
    account,
    poll: () => poller.pollAccountConversations(account()),
    stop: async () => {
      await canvas.stop();
      await openai.stop();
      fs.rmSync(workDir, { recursive: true, force: true });
    },
  };
}
