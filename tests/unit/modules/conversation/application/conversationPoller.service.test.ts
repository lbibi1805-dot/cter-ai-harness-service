import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ConversationPoller } from '../../../../../src/modules/conversation';
import {
  MAX_CONV_PER_ROUND,
  SETTINGS_CACHE_TTL_MS,
  buildConvStateKey,
  findPendingRequests,
  type ConversationMessage,
} from '../../../../../src/modules/conversation/domain';
import { AIProvider, ModelCatalog } from '../../../../../src/modules/ai';
import type { Answerer } from '../../../../../src/modules/agent/domain';
import type { CanvasAccountConfig } from '../../../../../src/shared/canvas/interfaces/canvasAccount.interface';
import { StateManager } from '../../../../../src/shared/state/processingStateStore';
import { buildTestAiConfig, perProvider } from '../../../../support/configFixture';
import { ProcessingStatus } from '../../../../../src/shared/state/enums/processingRecord.enums';

const mockAnswer = vi.fn<Answerer['answer']>();

const REQUEST = '[CFH:REQUEST]';

function req(id: number, body: string, attachments: ConversationMessage['attachments'] = []): ConversationMessage {
  return { id, body, createdAt: `2026-01-01T0${id}:00:00.000Z`, attachments };
}

function reqBody(provider = 'gemini', question = 'What is a mutex?', model?: string): string {
  return [REQUEST, `provider: ${provider}`, ...(model ? [`model: ${model}`] : []), '', question].join('\n');
}

const CATALOG = new ModelCatalog(buildTestAiConfig({
  defaultModels: perProvider((provider) => (provider === AIProvider.GEMINI ? 'gemini-2.5-flash' : `${provider}-test`)),
}));

function makePoller(state: StateManager, fake: FakeClient, now?: () => number): ConversationPoller {
  return new ConversationPoller(CATALOG, state, { answer: mockAnswer }, { createClient: () => fake as never, now });
}

const ACCOUNT: CanvasAccountConfig = { url: 'https://base', apiKey: 'tok', index: 1 };

class FakeClient {
  settingsMatches: { id: number; subject: string }[] = [{ id: 10, subject: '[CFH:SETTINGS] Canvas Settings' }];
  settingsRead: { activeConversationId: number | null; sawSystemPrompt: boolean } = { activeConversationId: 20, sawSystemPrompt: false };
  messages: ConversationMessage[] = [];
  replies: { conversationId: number; body: string }[] = [];
  failAddReply = false;
  downloaded: string[] = [];

  async listSettingsConversations(): Promise<{ id: number; subject: string }[]> { return this.settingsMatches; }
  async readSettings(): Promise<{ activeConversationId: number | null; sawSystemPrompt: boolean }> { return this.settingsRead; }
  async listMessages(): Promise<ConversationMessage[]> { return this.messages; }
  async addReply(conversationId: number, body: string): Promise<void> {
    if (this.failAddReply) throw new Error('post failed');
    this.replies.push({ conversationId, body });
  }
  async downloadAttachment(url: string): Promise<Buffer> {
    this.downloaded.push(url);
    return Buffer.from('fake-image');
  }
}

function makeState(): StateManager {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'conv-state-'));
  const state = new StateManager(path.join(dir, 'processed.json'));
  state.load();
  return state;
}

describe('conversationPoller', () => {
  beforeEach(() => {
    mockAnswer.mockReset();
    mockAnswer.mockImplementation(async (request) => ({ text: '# Answer', model: request.model, attempts: 1, contexts: [] }));
  });

  it('answers a pending text request with a [CFH:REPLY] and marks done', async () => {
    const fake = new FakeClient();
    fake.messages = [req(1, reqBody())];
    const state = makeState();
    const poller = makePoller(state, fake);
    await poller.pollAccountConversations(ACCOUNT);

    expect(fake.replies).toHaveLength(1);
    expect(fake.replies[0].conversationId).toBe(20);
    expect(fake.replies[0].body).toContain('[CFH:REPLY]');
    expect(fake.replies[0].body).toContain('request_id: 1');
    expect(fake.replies[0].body).toContain('# Answer');
    expect(state.getStatus(buildConvStateKey(1, 20, 1))).toBe('done');
    expect(mockAnswer).toHaveBeenCalledTimes(1);
  });

  it('skips requests that already have a matching reply', async () => {
    const fake = new FakeClient();
    fake.messages = [
      req(1, reqBody()),
      { id: 2, body: ['[CFH:REPLY]', 'request_id: 1', 'status: done', '', 'old'].join('\n'), createdAt: '2026-01-01T09:00:00.000Z', attachments: [] },
    ];
    const poller = makePoller(makeState(), fake);
    await poller.pollAccountConversations(ACCOUNT);
    expect(fake.replies).toHaveLength(0);
    expect(mockAnswer).not.toHaveBeenCalled();
  });

  it('skips messages already recorded in state', async () => {
    const fake = new FakeClient();
    fake.messages = [req(1, reqBody())];
    const state = makeState();
    const key = buildConvStateKey(1, 20, 1);
    state.setStatus({ fileId: key, fileName: key, accountIndex: 1, status: ProcessingStatus.DONE, retryCount: 0, updatedAt: new Date().toISOString() });
    const poller = makePoller(state, fake);
    await poller.pollAccountConversations(ACCOUNT);
    expect(fake.replies).toHaveLength(0);
  });

  it('replies invalid-format and marks failed for cloudflare provider (terminal)', async () => {
    const fake = new FakeClient();
    fake.messages = [req(1, reqBody('cloudflare', 'Hi', 'xai/grok-4.3'))];
    const state = makeState();
    const poller = makePoller(state, fake);
    await poller.pollAccountConversations(ACCOUNT);
    expect(fake.replies).toHaveLength(1);
    expect(fake.replies[0].body).toContain('status: invalid-format');
    expect(state.getStatus(buildConvStateKey(1, 20, 1))).toBe('failed');
    expect(mockAnswer).not.toHaveBeenCalled();
  });

  it('replies invalid-format and marks failed for unknown model', async () => {
    const fake = new FakeClient();
    fake.messages = [req(1, reqBody('gemini', 'Hi', 'nope-model'))];
    const state = makeState();
    const poller = makePoller(state, fake);
    await poller.pollAccountConversations(ACCOUNT);
    expect(fake.replies[0].body).toContain('status: invalid-format');
    expect(state.getStatus(buildConvStateKey(1, 20, 1))).toBe('failed');
  });

  it('keeps processing (not failed) when AI fails, so later rounds retry', async () => {
    mockAnswer.mockRejectedValue(new Error('boom'));
    const fake = new FakeClient();
    fake.messages = [req(1, reqBody())];
    const state = makeState();
    const poller = makePoller(state, fake);
    await poller.pollAccountConversations(ACCOUNT);
    expect(fake.replies).toHaveLength(0);
    expect(state.getStatus(buildConvStateKey(1, 20, 1))).toBe('processing');
  });

  it('keeps processing when addReply throws (no false done, no failed)', async () => {
    const fake = new FakeClient();
    fake.failAddReply = true;
    fake.messages = [req(1, reqBody())];
    const state = makeState();
    const poller = makePoller(state, fake);
    await poller.pollAccountConversations(ACCOUNT);
    expect(state.getStatus(buildConvStateKey(1, 20, 1))).toBe('processing');
  });

  it(`caps at ${MAX_CONV_PER_ROUND} messages per round`, async () => {
    const fake = new FakeClient();
    fake.messages = Array.from({ length: 7 }, (_, i) => req(i + 1, reqBody('gemini', `q${i + 1}`)));
    const poller = makePoller(makeState(), fake);
    await poller.pollAccountConversations(ACCOUNT);
    expect(fake.replies).toHaveLength(MAX_CONV_PER_ROUND);
  });

  it('downloads image attachments into imageBuffers', async () => {
    const fake = new FakeClient();
    fake.messages = [req(1, reqBody(), [{ id: '9', filename: 'a.png', url: 'https://x/files/9', contentType: 'image/png' }])];
    const poller = makePoller(makeState(), fake);
    await poller.pollAccountConversations(ACCOUNT);
    expect(fake.downloaded).toEqual(['https://x/files/9']);
    expect(mockAnswer.mock.calls[0][0].content.imageBuffers).toHaveLength(1);
  });

  it('skips silently when no settings conversation or no active id', async () => {
    const fake = new FakeClient();
    fake.settingsMatches = [];
    fake.messages = [req(1, reqBody())];
    const poller = makePoller(makeState(), fake);
    await poller.pollAccountConversations(ACCOUNT);
    expect(fake.replies).toHaveLength(0);

    fake.settingsMatches = [{ id: 10, subject: 's' }];
    fake.settingsRead = { activeConversationId: null, sawSystemPrompt: false };
    await poller.pollAccountConversations(ACCOUNT);
    expect(fake.replies).toHaveLength(0);
  });

  it('caches settings discovery between rounds and refreshes after the TTL', async () => {
    const fake = new FakeClient();
    const discover = vi.spyOn(fake, 'listSettingsConversations');
    let now = 1_000_000;
    const poller = makePoller(makeState(), fake, () => now);

    await poller.pollAccountConversations(ACCOUNT);
    await poller.pollAccountConversations(ACCOUNT);
    expect(discover).toHaveBeenCalledTimes(1);

    now += SETTINGS_CACHE_TTL_MS + 1;
    await poller.pollAccountConversations(ACCOUNT);
    expect(discover).toHaveBeenCalledTimes(2);
  });

  it('drops the cached settings conversation when reading it fails', async () => {
    const fake = new FakeClient();
    const discover = vi.spyOn(fake, 'listSettingsConversations');
    const poller = makePoller(makeState(), fake);
    await poller.pollAccountConversations(ACCOUNT);
    vi.spyOn(fake, 'readSettings').mockRejectedValueOnce(new Error('404 Not Found'));
    await poller.pollAccountConversations(ACCOUNT);
    await poller.pollAccountConversations(ACCOUNT);
    expect(discover).toHaveBeenCalledTimes(2);
  });

  it('posts a reply without re-calling the AI when only the reply post failed before', async () => {
    const fake = new FakeClient();
    fake.messages = [req(1, reqBody())];
    fake.failAddReply = true;
    const poller = makePoller(makeState(), fake);
    await poller.pollAccountConversations(ACCOUNT);
    expect(mockAnswer).toHaveBeenCalledTimes(1);
  });

  it('findPendingRequests matches legacy replies without request_id FIFO', () => {
    const messages = [
      req(1, reqBody('gemini', 'first')),
      req(2, reqBody('gemini', 'second')),
      { id: 3, body: ['[CFH:REPLY]', 'status: done', '', 'answer'].join('\n'), createdAt: '2026-01-01T09:00:00.000Z', attachments: [] },
    ];
    const pending = findPendingRequests(messages);
    expect(pending.map((pendingRequest) => pendingRequest.message.id)).toEqual([2]);
  });
});
