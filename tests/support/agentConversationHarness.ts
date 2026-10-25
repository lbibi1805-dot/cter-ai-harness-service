// Shared setup for the client ↔ backend connection tests: a fake Canvas, a fake
// OpenAI Responses endpoint, and the REAL conversation poller + agent module wired
// like src/bootstrap/main.ts. Only the AI providers are fake.
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { vi, type Mock } from 'vitest';
import { AIProvider, createAiModule, type AIAdapter } from '../../src/modules/ai';
import { createAgentModule, createOpenAIToolModelFactory } from '../../src/modules/agent';
import { createConversationPoller } from '../../src/modules/conversation';
import { FileVaultRepository } from '../../src/modules/vault';
import type { CanvasAccountConfig } from '../../src/shared/canvas/interfaces/canvasAccount.interface';
import { StateManager } from '../../src/shared/state/processingStateStore';
import { buildTestAiConfig, buildTestConfig, perProvider } from './configFixture';
import { FakeCanvasServer } from './fakeCanvasServer';
import { FakeOpenAIResponsesServer } from './fakeOpenAIResponsesServer';

export const HARNESS_VAULT_DOC = 'mon-qnx-current/lab-4/Mutex-vs-Semaphore.md';
export const HARNESS_VAULT_TEXT = 'sem_wait blocks at zero.';
export const SINGLE_SHOT_ANSWER = 'single-shot answer';
const AGENT_MODEL = 'gpt-6-astra';
const HARNESS_TIMEOUT_MS = 5000;

export interface AgentConversationHarness {
  canvas: FakeCanvasServer;
  openai: FakeOpenAIResponsesServer;
  singleShot: Mock<AIAdapter['process']>;
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

  const config = buildTestConfig({
    accounts: [account()],
    ai: buildTestAiConfig({
      keys: { [AIProvider.OPENAI]: 'k' },
      defaultModels: perProvider((provider) => (provider === AIProvider.OPENAI ? AGENT_MODEL : `${provider}-test`)),
      maxRetryCount: 0,
    }),
  });

  const singleShot = vi.fn<AIAdapter['process']>(async (_content, _system, model) => ({ text: SINGLE_SHOT_ANSWER, model }));
  const adapter: AIAdapter = { validate: async () => undefined, process: singleShot };
  const ai = createAiModule(
    { ai: config.ai, systemPrompt: config.prompts.systemPrompt, knowledgeContent: '' },
    { adapters: { direct: () => adapter, openRouter: () => null, credentialName: () => 'OPENAI_API_KEY' }, sleep: async () => undefined },
  );
  const { answers } = createAgentModule({ limits: config.agent, systemPrompt: config.prompts.systemPrompt }, {
    singleShot: ai.invocation,
    vaultRepository: vault,
    createModel: createOpenAIToolModelFactory({ apiKey: 'k', timeoutMs: HARNESS_TIMEOUT_MS, baseURL: openai.baseURL, sleep: async () => undefined }),
    retrieval: null,
    searcher: { search: async () => [{ chunkId: 'c', source: HARNESS_VAULT_DOC, heading: 'Semaphore', parentHeading: '', text: HARNESS_VAULT_TEXT, tokenCount: 5, score: 0.8 }] },
  });
  const state = new StateManager(path.join(workDir, 'processed.json'));
  state.load();
  const poller = createConversationPoller({ catalog: ai.catalog, state, answers });

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
