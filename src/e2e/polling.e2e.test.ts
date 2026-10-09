// End-to-end: real ApiServer + PollScheduler + FileQAJob + ConversationPoller +
// CanvasClient/ConversationClient over HTTP + real PDF rendering (Chromium),
// against FakeCanvasServer. Only the AI provider is faked.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { AddressInfo } from 'net';
import { ApiServer } from '../api/server';
import { AIInvocationService, PromptPreparer } from '../modules/ai';
import { FilePollCursorRepository, PollJobName, createPollingModule, type PollingModule } from '../modules/polling';
import type { VaultModule } from '../modules/vault';
import { ConversationPoller } from '../orchestrator/conversationPoller';
import { FileQAJob } from '../orchestrator/fileQAJob';
import { StorageProvider } from '../shared/database/database.enums';
import { Router } from '../shared/http/router';
import { StateManager } from '../state/stateManager';
import type { AIAdapter, AppConfig } from '../types';
import type { EmailNotifier } from '../utils/emailNotifier';
import { closeBrowser, getBrowser } from '../utils/markdownToPdf';
import { FakeCanvasServer } from './fakeCanvasServer';
import { FakeOpenAIResponsesServer } from './fakeOpenAIResponsesServer';
import { AgentToolName, createAgentModule } from '../modules/agent';
import { createOpenAIToolModelFactory } from '../modules/agent/infrastructure/openaiResponsesToolModel';
import { FileVaultRepository } from '../modules/vault/infrastructure/fileVault.repository';

const PDF_MAGIC = '%PDF';

describe.skipIf(process.env.SKIP_BROWSER_TESTS === '1')('polling end-to-end', () => {
  const canvas = new FakeCanvasServer();
  const openai = new FakeOpenAIResponsesServer();
  const VAULT_DOC = 'mon-qnx-current/lab-4/Mutex-vs-Semaphore.md';
  let vaultRepository: FileVaultRepository;
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'polling-e2e-'));
  const cursorFile = path.join(workDir, 'poll-cursors.json');
  const aiProcess = vi.fn(async (content: { textContent: string }) => `# Answer\n\nYou asked: ${content.textContent.split('\n')[0]}`);
  let config: AppConfig;
  let apiBase = '';
  let apiServer: ApiServer;
  let polling: PollingModule;

  /** Builds the app the same way src/index.ts does, with a fresh StateManager (lost on restart, like Render). */
  function bootApp(): PollingModule {
    const state = new StateManager(path.join(workDir, `processed-${Date.now()}-${Math.random()}.json`));
    state.load();
    const adapter: AIAdapter = { validate: async () => undefined, process: aiProcess as AIAdapter['process'] };
    const ai = new AIInvocationService(config, new PromptPreparer('sys', ''), { createAdapter: () => adapter, sleep: async () => undefined });
    const notifier = { notifySuccess: vi.fn(), notifyError: vi.fn() } as unknown as EmailNotifier;
    const { answers } = createAgentModule(config, {
      ai,
      vaultRepository,
      createModel: createOpenAIToolModelFactory({ apiKey: 'test', timeoutMs: 5000, baseURL: openai.baseURL, sleep: async () => undefined }),
      searcher: { search: async () => [{ chunkId: 'c1', source: VAULT_DOC, heading: 'Mutex', parentHeading: '', text: 'Mutex: chỉ thread đang giữ khóa mới được unlock.', tokenCount: 10, score: 0.82 }] },
    });
    return createPollingModule(config, {
      jobs: [new FileQAJob(config, state, notifier, answers), new ConversationPoller(config, state, undefined, undefined, answers)],
      validateKeys: async () => [{ provider: 'gemini', ok: true }],
      beforeTick: () => { state.resetStaleProcessing(60_000); },
      cursors: new FilePollCursorRepository(cursorFile),
    });
  }

  async function api(pathname: string) {
    const res = await fetch(`${apiBase}${pathname}`);
    return { status: res.status, body: await res.json() };
  }

  beforeAll(async () => {
    await canvas.start();
    await openai.start();
    vaultRepository = new FileVaultRepository(workDir);
    await vaultRepository.save({
      filePath: VAULT_DOC, hash: 'h', chunkIds: [], indexed: true,
      content: '## Mutex\nOwner thread unlocks; priority inheritance.\n## Semaphore\nsem_wait blocks at zero.',
    });
    config = {
      accounts: [{ url: canvas.baseUrl, apiKey: 'token', index: 1 }],
      aiKeys: { gemini: 'k', openai: 'k' },
      defaultModels: { claude: 'c', gemini: 'gemini-3.5-flash', grok: 'g', openai: 'gpt-6-astra' },
      modelFallback: { claude: [], gemini: [], grok: [], openai: [] },
      pollIntervalMs: 60_000,
      maxRetryCount: 1,
      systemPrompt: 'sys',
      knowledgeContent: '',
      grokBaseUrl: '',
      aiTimeoutMs: 5000,
      gmail: {},
      canvasFolder: { materials: 'Materials2', input: 'Q', output: 'A' },
      database: { provider: StorageProvider.FILE },
      pollAutostart: false,
      agent: { maxToolCalls: 4, maxDurationMs: 30_000 },
    };
    polling = bootApp();
    const vaultStub = { router: new Router([], undefined), service: { stats: async () => ({ total: 0, indexed: 0 }) } } as unknown as VaultModule;
    apiServer = new ApiServer(config, {} as EmailNotifier, 0, vaultStub, polling);
    apiServer.start();
    const server = (apiServer as unknown as { server: import('http').Server }).server;
    await new Promise<void>((resolve) => (server.listening ? resolve() : server.once('listening', () => resolve())));
    apiBase = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }, 30_000);

  afterAll(async () => {
    polling.scheduler.stop();
    (apiServer as unknown as { server: import('http').Server }).server.close();
    await canvas.stop();
    await openai.stop();
    await closeBrowser();
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  it('1. answers files (across pages) and a chat request in one tick, with real PDFs', async () => {
    canvas.addInputFile('START_q1_gemini.txt', '2026-10-01T10:00:00Z', 'What is a mutex?');
    canvas.addInputFile('START_q2_gemini.txt', '2026-10-01T10:01:00Z', 'What is a semaphore?');
    canvas.addInputFile('START_q3_gemini.txt', '2026-10-01T10:02:00Z', 'What is a pulse?');
    canvas.addInputFile('notes.txt', '2026-10-01T10:03:00Z', 'ignored: no START_ prefix');
    const requestId = canvas.addConversationRequest('Explain priority inversion');

    const report = await polling.scheduler.runTick();

    expect(report!.failures).toEqual([]);
    expect(canvas.output.map((f) => f.name).sort()).toEqual(['START_q1_gemini_DONE.pdf', 'START_q2_gemini_DONE.pdf', 'START_q3_gemini_DONE.pdf']);
    for (const file of canvas.output) expect(file.body.subarray(0, 4).toString()).toBe(PDF_MAGIC);
    expect(canvas.count(/folders\/2\/files.*page=2/)).toBe(1);

    const reply = canvas.conversation.find((m) => m.body.startsWith('[CFH:REPLY]'));
    expect(reply?.body).toContain(`request_id: ${requestId}`);
    expect(reply?.body).toContain('You asked: Explain priority inversion');

    const cursors = JSON.parse(fs.readFileSync(cursorFile, 'utf-8'));
    expect(cursors[`${PollJobName.FILE_QA}:1`]).toBe('2026-10-01T10:02:00.000Z');
  }, 60_000);

  it('2. after a restart with lost local state, nothing is re-answered', async () => {
    const callsBefore = aiProcess.mock.calls.length;
    const uploadsBefore = canvas.output.length;
    const restarted = bootApp();

    await restarted.scheduler.runTick();

    expect(aiProcess.mock.calls.length).toBe(callsBefore);
    expect(canvas.output.length).toBe(uploadsBefore);
    expect(canvas.conversation.filter((m) => m.body.startsWith('[CFH:REPLY]'))).toHaveLength(1);
  }, 60_000);

  it('3. a Canvas 500 during listing loses no file', async () => {
    canvas.addInputFile('START_during_outage_gemini.txt', '2026-10-01T11:00:00Z', 'Uploaded right before the outage');
    canvas.failInputListings = 1;

    const failed = await polling.scheduler.runTick();
    expect(failed!.failures).toEqual([expect.objectContaining({ job: PollJobName.FILE_QA, accountIndex: 1 })]);
    expect(canvas.output.some((f) => f.name === 'START_during_outage_gemini_DONE.pdf')).toBe(false);

    await polling.scheduler.runTick();
    expect(canvas.output.some((f) => f.name === 'START_during_outage_gemini_DONE.pdf')).toBe(true);
  }, 60_000);

  it('4. keeps rendering after Chromium is killed between ticks (OOM simulation)', async () => {
    const browser = await getBrowser();
    browser.process()?.kill('SIGKILL');
    await new Promise((resolve) => browser.once('disconnected', resolve));
    canvas.addInputFile('START_after_crash_gemini.txt', '2026-10-01T12:00:00Z', 'Still alive?');

    const report = await polling.scheduler.runTick();

    expect(report!.failures).toEqual([]);
    const pdf = canvas.output.find((f) => f.name === 'START_after_crash_gemini_DONE.pdf');
    expect(pdf?.body.subarray(0, 4).toString()).toBe(PDF_MAGIC);
  }, 60_000);

  it('5. discovers the settings conversation once, not on every tick', () => {
    expect(canvas.count(/^GET \/api\/v1\/conversations\?/)).toBe(2); // one per app instance (first boot + restart)
  });

  it('6. exposes polling control over HTTP', async () => {
    expect((await api('/api/polling')).body).toMatchObject({ state: 'stopped', skippedTicks: 0 });
    expect((await api('/start')).body).toEqual({ status: 'started', validation: [{ provider: 'gemini', ok: true }] });
    expect((await api('/start')).body).toEqual({ status: 'already_running' });
    expect((await api('/health')).body).toMatchObject({ status: 'up', polling: 'running' });
    expect((await api('/stop')).body).toEqual({ status: 'stopped' });
    expect((await api('/')).body).toMatchObject({ polling: 'stopped' });
    expect((await api('/nope')).status).toBe(404);
  }, 60_000);

  it('7. agent mode: a `_agent` file researches the vault through tools before answering', async () => {
    await polling.scheduler.whenIdle(); // test 6 started a background tick via /start
    openai.requests.length = 0;
    openai.responder = (_body, i) => {
      if (i === 0) return { functionCall: { name: AgentToolName.SEARCH_VAULT, arguments: { query: 'mutex ownership' } } };
      if (i === 1) return { functionCall: { name: AgentToolName.READ_DOCUMENT, arguments: { path: VAULT_DOC, heading: 'Semaphore' } } };
      return { text: `# Answer

Evidence: ${openai.lastToolOutputs().join(' || ')}

## References
- ${VAULT_DOC}` };
    };
    const singleShotCalls = aiProcess.mock.calls.length;
    canvas.addInputFile('START_agentq_openai_agent.txt', '2026-10-01T13:00:00Z', 'Compare mutex and semaphore');

    const report = await polling.scheduler.runTick();

    expect(report!.failures).toEqual([]);
    const pdf = canvas.output.find((f) => f.name === 'START_agentq_openai_agent_DONE.pdf');
    expect(pdf?.body.subarray(0, 4).toString()).toBe(PDF_MAGIC);
    expect(openai.requests).toHaveLength(3);
    const toolOutputs = openai.lastToolOutputs().join('\n');
    expect(toolOutputs).toContain('chỉ thread đang giữ khóa');
    expect(toolOutputs).toContain('sem_wait blocks at zero');
    expect(toolOutputs).not.toContain('Owner thread unlocks');
    expect(aiProcess.mock.calls.length).toBe(singleShotCalls);
  }, 60_000);

  it('8. agent mode in chat: `mode: agent` request gets an agent reply', async () => {
    openai.requests.length = 0;
    openai.responder = (_body, i) => (i === 0
      ? { functionCall: { name: AgentToolName.SEARCH_VAULT, arguments: { query: 'semaphore' } } }
      : { text: 'agent chat answer' });
    const id = canvas.addConversationRequest('mode test');
    const request = canvas.conversation.find((m) => m.id === id)!;
    request.body = request.body.replace('provider: gemini', 'provider: openai\nmode: agent');

    await polling.scheduler.runTick();

    const reply = canvas.conversation.find((m) => m.body.includes(`request_id: ${id}`));
    expect(reply?.body).toContain('mode: agent');
    expect(reply?.body).toContain('agent chat answer');
  }, 60_000);

  it('9. agent failure falls back to single-shot — the answer is never lost', async () => {
    openai.responder = () => ({ status: 400, error: 'tool schema rejected' });
    const singleShotCalls = aiProcess.mock.calls.length;
    canvas.addInputFile('START_fallback_openai_agent.txt', '2026-10-01T14:00:00Z', 'Fallback please');

    const report = await polling.scheduler.runTick();

    expect(report!.failures).toEqual([]);
    expect(canvas.output.some((f) => f.name === 'START_fallback_openai_agent_DONE.pdf')).toBe(true);
    expect(aiProcess.mock.calls.length).toBe(singleShotCalls + 1);
  }, 60_000);
});
