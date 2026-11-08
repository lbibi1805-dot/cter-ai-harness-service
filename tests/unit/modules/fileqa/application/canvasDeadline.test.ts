import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import type { AnswerRequest, Answerer } from '../../../../../src/modules/agent/domain';
import {
  AIInvocationService,
  AIProvider,
  DEFAULT_AI_LATENCY,
  DEFAULT_CANVAS_DEADLINE_MS,
  DEFAULT_CHAT_DEADLINE_MS,
  ModelCatalog,
  PromptPreparer,
  type AIAdapter,
} from '../../../../../src/modules/ai';
import { ChatService } from '../../../../../src/modules/chat';
import { toChatQuestion } from '../../../../../src/modules/chat/presentation/mappers/chat.mapper';
import { createConversationPoller } from '../../../../../src/modules/conversation';
import { createFileQaJob } from '../../../../../src/modules/fileqa';
import type { CanvasFile, CanvasFilesGateway, CanvasFolder } from '../../../../../src/modules/fileqa/domain';
import type { Notifier } from '../../../../../src/modules/notification';
import type { CanvasAccountConfig } from '../../../../../src/shared/canvas/interfaces/canvasAccount.interface';
import { StateManager } from '../../../../../src/shared/state/processingStateStore';
import { buildTestAiConfig, perProvider } from '../../../../support/configFixture';

const ACCOUNT: CanvasAccountConfig = { url: 'https://canvas', apiKey: 'k', index: 1 };
const FOLDERS: CanvasFolder[] = [
  { id: 2, name: 'Q', full_name: 'Materials2/Q', parent_folder_id: 1 },
  { id: 3, name: 'A', full_name: 'Materials2/A', parent_folder_id: 1 },
];
const AI_CONFIG = buildTestAiConfig({ defaultModels: perProvider((p) => (p === AIProvider.GEMINI ? 'gemini-3.5-flash' : `${p}-test`)), timeoutMs: 1000 });

function canvasWithOneFile(): CanvasFilesGateway & { uploaded: string[] } {
  const file: CanvasFile = { id: 100, display_name: 'START_a_gemini.txt', url: 'https://canvas/files/a', size: 1, updated_at: '2026-10-01T10:00:00Z' };
  const uploaded: string[] = [];
  return {
    uploaded,
    findFolderByPath: async () => ({ id: 1, name: 'Materials2', full_name: 'Materials2', parent_folder_id: null }),
    listSubfolders: async () => FOLDERS,
    createFolder: async () => { throw new Error('not expected'); },
    listFilesInFolder: async () => [file],
    listAllFilesInFolder: async () => [],
    downloadFile: async () => Buffer.from('question'),
    uploadFileToFolder: async (_id: number, name: string) => { uploaded.push(name); },
  } as unknown as CanvasFilesGateway & { uploaded: string[] };
}

function state(): StateManager {
  const s = new StateManager(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'deadline-')), 'processed.json'));
  s.load();
  return s;
}

const renderer = {
  success: async () => Buffer.from('ok'),
  error: async () => Buffer.from('err'),
  invalidModel: async () => Buffer.from('invalid'),
};
const notifier = { notifySuccess: () => undefined, notifyError: () => undefined } as unknown as Notifier;

describe('CANVAS_DEADLINE_MS (polling) vs CHAT_DEADLINE_MS (interactive chat)', () => {
  it('defaults: chat 90 s, Canvas 300 s', () => {
    expect(DEFAULT_CHAT_DEADLINE_MS).toBe(90_000);
    expect(DEFAULT_CANVAS_DEADLINE_MS).toBe(300_000);
    expect(DEFAULT_AI_LATENCY.canvasDeadlineMs).toBe(300_000);
  });

  it('file Q&A: the answer call gets deadlineAt = now + CANVAS_DEADLINE_MS', async () => {
    const requests: AnswerRequest[] = [];
    const answers: Answerer = { answer: async (r) => { requests.push(r); return { text: '# A', model: r.model, attempts: 1, contexts: [] }; } };
    const canvas = canvasWithOneFile();
    const job = createFileQaJob({ materials: 'Materials2', input: 'Q', output: 'A' }, {
      catalog: new ModelCatalog(AI_CONFIG), state: state(), notifier, answers, deadlineMs: DEFAULT_CANVAS_DEADLINE_MS,
      overrides: { createClient: () => canvas, extract: async (b: Buffer) => ({ textContent: b.toString(), imageBuffers: [] }), renderer, sleep: async () => undefined, now: () => 1_000 },
    });
    await job.run(ACCOUNT, { cursor: null });
    expect(requests).toHaveLength(1);
    expect(requests[0].deadlineAt).toBe(1_000 + DEFAULT_CANVAS_DEADLINE_MS);
    expect(canvas.uploaded).toEqual(['START_a_gemini_DONE.pdf']);
  });

  it('file Q&A through the real invocation: a retry after 100 s still runs (it would hit the 90 s chat deadline)', async () => {
    let clock = 0;
    let calls = 0;
    const adapter: AIAdapter = {
      validate: async () => undefined,
      process: async (_content, _system, model) => {
        calls++;
        clock += 100_000;
        if (calls === 1) throw Object.assign(new Error('HTTP 500'), { status: 500 });
        return { text: '# Long PDF answer', model };
      },
    };
    const catalog = new ModelCatalog(AI_CONFIG);
    const adapters = { direct: () => adapter, openRouter: () => null, credentialName: () => 'GEMINI_API_KEY' };
    const invocation = new AIInvocationService(AI_CONFIG, catalog, new PromptPreparer('sys', ''), adapters, { sleep: async () => undefined, now: () => clock });
    const run = async (deadlineMs?: number) => {
      calls = 0;
      const canvas = canvasWithOneFile();
      const job = createFileQaJob({ materials: 'Materials2', input: 'Q', output: 'A' }, {
        catalog, state: state(), notifier, answers: { answer: (r) => invocation.answer(r) }, ...(deadlineMs ? { deadlineMs } : {}),
        overrides: { createClient: () => canvas, extract: async (b: Buffer) => ({ textContent: b.toString(), imageBuffers: [] }), renderer, sleep: async () => undefined, now: () => clock },
      });
      await job.run(ACCOUNT, { cursor: null });
      return { calls, uploaded: canvas.uploaded };
    };
    expect(await run(DEFAULT_CANVAS_DEADLINE_MS)).toEqual({ calls: 2, uploaded: ['START_a_gemini_DONE.pdf'] });
    // Without the Canvas deadline (old behaviour) the chain stops at CHAT_DEADLINE_MS after the first attempt.
    expect((await run()).calls).toBe(1);
  });

  it('Canvas conversation requests get the Canvas deadline too', async () => {
    const requests: AnswerRequest[] = [];
    const poller = createConversationPoller({
      catalog: new ModelCatalog(AI_CONFIG), state: state(), deadlineMs: DEFAULT_CANVAS_DEADLINE_MS,
      answers: { answer: async (r) => { requests.push(r); return { text: '# A', model: r.model, attempts: 1, contexts: [] }; } },
      overrides: {
        now: () => 5_000,
        createClient: () => ({
          listSettingsConversations: async () => [{ id: 10, subject: '[CFH:SETTINGS] Canvas Settings' }],
          readSettings: async () => ({ activeConversationId: 20, sawSystemPrompt: false }),
          listMessages: async () => [{ id: 1, body: '[CFH:REQUEST]\nprovider: gemini\n\nWhat is a mutex?', createdAt: '2026-01-01T01:00:00.000Z', attachments: [] }],
          addReply: async () => undefined,
          downloadAttachment: async () => Buffer.from(''),
        }) as never,
      },
    });
    await poller.run(ACCOUNT);
    expect(requests[0]?.deadlineAt).toBe(5_000 + DEFAULT_CANVAS_DEADLINE_MS);
  });

  it('interactive chat is unchanged: no deadlineAt from the chat service (invocation default = CHAT_DEADLINE_MS)', async () => {
    const requests: AnswerRequest[] = [];
    const service = new ChatService(
      { answer: async (r) => { requests.push(r); return { text: 'x', model: r.model, attempts: 1, contexts: [] }; } },
      new ModelCatalog(AI_CONFIG),
      { enabled: true, agentEnabled: false, isProviderConfigured: () => true },
    );
    await service.ask(toChatQuestion({ provider: 'gemini', question: 'hi' }));
    expect(requests[0].deadlineAt).toBeUndefined();
  });
});
