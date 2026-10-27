import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { Readable } from 'stream';
import type { IncomingMessage, ServerResponse } from 'http';
import { Router } from '../../../../../src/shared/http/router';
import { AgentFallbackReason, AnswerMode, type Answerer } from '../../../../../src/modules/agent/domain';
import { ChatController } from '../../../../../src/modules/chat/presentation/chat.controller';
import { ChatService } from '../../../../../src/modules/chat/application/chat.service';
import { createChatRoutes } from '../../../../../src/modules/chat/presentation/chat.routes';
import { AIProvider, ModelCatalog, ProgressStage, type PerProvider } from '../../../../../src/modules/ai';
import { buildTestAiConfig } from '../../../../support/configFixture';
import { MAX_CHAT_IMAGES } from '../../../../../src/modules/chat/presentation/constants/chat.constants';

const TOKEN = 'chat-secret';
const DEFAULT_MODELS: PerProvider<string> = { claude: 'claude-sonnet-4-6', gemini: 'gemini-2.0-flash', grok: 'grok-3', openai: 'gpt-6-astra' };
const CATALOG = new ModelCatalog(buildTestAiConfig({ defaultModels: DEFAULT_MODELS }));
const CHUNK = { chunkId: 'c1', text: 'mutex text', source: 'os/sync.md', heading: 'Mutex', parentHeading: '', tokenCount: 3, score: 0.9 };
const PNG_BASE64 = Buffer.from('fake-png').toString('base64');

let answer: Mock<Answerer['answer']>;
let router: Router;

function build(enabled = true) {
  answer = vi.fn<Answerer['answer']>().mockResolvedValue({ text: 'hi', model: 'gemini-2.0-flash', attempts: 1, mode: AnswerMode.SINGLE_SHOT, contexts: [CHUNK] });
  const service = new ChatService({ answer }, CATALOG, { enabled, agentEnabled: true, isProviderConfigured: (provider) => provider === AIProvider.GEMINI });
  const controller = new ChatController(service);
  router = new Router(createChatRoutes(controller), enabled ? TOKEN : undefined);
}

async function call(method: string, url: string, body?: unknown, auth = `Bearer ${TOKEN}`) {
  let status = 0;
  let text = '';
  const res = {
    writeHead: vi.fn((code: number) => { status = code; }),
    end: vi.fn((chunk: string) => { text = chunk; }),
  } as unknown as ServerResponse;
  const payload = body === undefined ? [] : [Buffer.from(typeof body === 'string' ? body : JSON.stringify(body))];
  const req = Object.assign(Readable.from(payload), { method, url, headers: { authorization: auth } }) as unknown as IncomingMessage;
  await router.dispatch(req, res, new URL(url, 'http://localhost'));
  return { status, body: JSON.parse(text) };
}

describe('chat routes', () => {
  beforeEach(() => build());

  it('rejects a wrong bearer token', async () => {
    const { status } = await call('POST', '/api/chat', { provider: 'gemini', question: 'q' }, 'Bearer nope');
    expect(status).toBe(401);
    expect(answer).not.toHaveBeenCalled();
  });

  it('answers 503 on every route when CHAT_API_TOKEN is unset', async () => {
    build(false);
    expect((await call('POST', '/api/chat', { provider: 'gemini', question: 'q' }, '')).status).toBe(503);
    expect((await call('GET', '/api/chat/status', undefined, '')).status).toBe(503);
    expect(answer).not.toHaveBeenCalled();
  });

  it('GET /status reports providers and agent availability', async () => {
    const { status, body } = await call('GET', '/api/chat/status');
    expect(status).toBe(200);
    expect(body).toMatchObject({ ok: true, agentEnabled: true, providers: { gemini: true, openai: false }, defaultModels: DEFAULT_MODELS });
    expect(body.models.openai).toContain('gpt-6-astra');
  });

  it('POST answers with the provider default model and single-shot mode', async () => {
    const { status, body } = await call('POST', '/api/chat', { provider: 'Gemini', question: '  What is TDD? ' });
    expect(status).toBe(200);
    expect(answer).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'gemini', model: 'gemini-2.0-flash', mode: AnswerMode.SINGLE_SHOT,
      content: { textContent: 'What is TDD?', imageBuffers: [], history: [] },
    }));
    expect(body).toMatchObject({ text: 'hi', provider: 'gemini', model: 'gemini-2.0-flash', mode: AnswerMode.SINGLE_SHOT, fallbackReason: null });
  });

  it('passes agent mode and reports a single-shot fallback', async () => {
    answer.mockResolvedValue({ text: 'x', model: 'gpt-6-astra', attempts: 1, mode: AnswerMode.SINGLE_SHOT, fallbackReason: AgentFallbackReason.AGENT_FAILED, contexts: [] });
    const { body } = await call('POST', '/api/chat', { provider: 'openai', model: 'gpt-6-astra', mode: 'agent', question: 'q' });
    expect(answer).toHaveBeenCalledWith(expect.objectContaining({ mode: AnswerMode.AGENT }));
    expect(body).toMatchObject({ requestedMode: AnswerMode.AGENT, mode: AnswerMode.SINGLE_SHOT, fallbackReason: AgentFallbackReason.AGENT_FAILED });
  });

  it('returns the retrieval trace only when includeTrace is set', async () => {
    const plain = await call('POST', '/api/chat', { provider: 'gemini', question: 'q' });
    expect(plain.body.trace).toBeUndefined();

    const traced = await call('POST', '/api/chat', { provider: 'gemini', question: 'q', includeTrace: true });
    expect(traced.body.trace).toEqual({ contexts: [CHUNK] });
  });

  it('passes the normalized conversation history with the question', async () => {
    await call('POST', '/api/chat', {
      provider: 'gemini',
      question: 'and the one before?',
      history: [
        { role: 'assistant', text: 'orphan greeting' },
        { role: 'user', text: 'What is TDD?' },
        { role: 'assistant', text: 'Test-driven development.' },
        { role: 'user', text: 'unanswered' },
      ],
    });
    expect(answer.mock.calls[0][0].content.history).toEqual([
      { role: 'user', text: 'What is TDD?' },
      { role: 'assistant', text: 'Test-driven development.' },
    ]);
  });

  it('decodes data-URL and raw base64 images; an image alone is a valid question', async () => {
    const { status } = await call('POST', '/api/chat', {
      provider: 'gemini',
      images: [{ data: `data:image/png;base64,${PNG_BASE64}` }, { mimeType: 'image/jpeg', data: PNG_BASE64 }],
    });
    expect(status).toBe(200);
    const { content } = answer.mock.calls[0][0];
    expect(content.textContent).toBe('');
    expect(content.imageBuffers.map((i: { mimeType: string }) => i.mimeType)).toEqual(['image/png', 'image/jpeg']);
    expect(content.imageBuffers[0].data.toString()).toBe('fake-png');
  });

  it.each([
    [{ question: 'q' }, 'Missing provider'],
    [{ provider: 'mistral', question: 'q' }, 'not servable'],
    [{ provider: 'gemini', model: 'gpt-4o', question: 'q' }, 'not supported'],
    [{ provider: 'gemini' }, 'question or at least one image'],
    [{ provider: 'gemini', images: [{ mimeType: 'text/plain', data: PNG_BASE64 }] }, 'images[0]'],
    [{ provider: 'gemini', question: 'q', history: 'nope' }, 'history must be an array'],
    [{ provider: 'gemini', question: 'q', history: [{ role: 'system', text: 'x' }] }, 'history[0]'],
    [{ provider: 'gemini', images: Array(MAX_CHAT_IMAGES + 1).fill({ mimeType: 'image/png', data: PNG_BASE64 }) }, 'At most'],
  ])('400 for invalid body %j', async (payload, message) => {
    const { status, body } = await call('POST', '/api/chat', payload);
    expect(status).toBe(400);
    expect(body.error).toContain(message);
    expect(answer).not.toHaveBeenCalled();
  });

  it('400 for malformed JSON', async () => {
    const { status } = await call('POST', '/api/chat', '{not json');
    expect(status).toBe(400);
  });

  it('502 when every model fails', async () => {
    answer.mockRejectedValue(new Error('all models exhausted'));
    const { status, body } = await call('POST', '/api/chat', { provider: 'gemini', question: 'q' });
    expect(status).toBe(502);
    expect(body.error).toContain('all models exhausted');
  });
});

describe('chat routes — streaming', () => {
  beforeEach(() => build());

  it('answers stream=true as NDJSON delta/reset/done events', async () => {
    answer.mockImplementation(async (request) => {
      request.stream?.delta('Hel');
      request.stream?.reset();
      request.stream?.delta('Hello');
      return { text: 'Hello', model: 'gemini-2.0-flash', attempts: 2, mode: AnswerMode.SINGLE_SHOT, contexts: [] };
    });
    const chunks: string[] = [];
    let status = 0;
    let headers: Record<string, string> = {};
    const res = {
      headersSent: false,
      writableEnded: false,
      writeHead: vi.fn(function (this: { headersSent: boolean }, code: number, h: Record<string, string>) { status = code; headers = h; this.headersSent = true; }),
      flushHeaders: vi.fn(),
      write: vi.fn((chunk: string) => { chunks.push(chunk); return true; }),
      end: vi.fn((chunk?: string) => { if (chunk) chunks.push(chunk); }),
    } as unknown as ServerResponse;
    const body = Buffer.from(JSON.stringify({ provider: 'gemini', question: 'hi', stream: true }));
    const req = Object.assign(Readable.from([body]), { method: 'POST', url: '/api/chat', headers: { authorization: `Bearer ${TOKEN}` } }) as unknown as IncomingMessage;
    await router.dispatch(req, res, new URL('/api/chat', 'http://localhost'));

    expect(status).toBe(200);
    expect(headers['Content-Type']).toContain('application/x-ndjson');
    const events = chunks.join('').trim().split('\n').map((line) => JSON.parse(line));
    // `preparing` goes out before the prompt is built, so the client can show something at once.
    expect(events.map((e) => e.type)).toEqual(['progress', 'delta', 'reset', 'delta', 'done']);
    expect(events[0]).toMatchObject({ stage: 'preparing' });
    expect(events[4]).toMatchObject({ text: 'Hello', provider: 'gemini' });
  });

  it('forwards pipeline progress (agent tool calls) as progress events', async () => {
    answer.mockImplementation(async (request) => {
      request.stream?.progress?.({ stage: ProgressStage.ANSWERING });
      request.stream?.progress?.({ stage: ProgressStage.AGENT_TOOL, detail: 'search_vault' });
      return { text: 'from the vault', model: 'gpt-6-astra', attempts: 1, mode: AnswerMode.AGENT, contexts: [] };
    });
    const chunks: string[] = [];
    const res = {
      headersSent: false,
      writableEnded: false,
      writeHead: vi.fn(),
      flushHeaders: vi.fn(),
      write: vi.fn((chunk: string) => { chunks.push(chunk); return true; }),
      end: vi.fn((chunk?: string) => { if (chunk) chunks.push(chunk); }),
    } as unknown as ServerResponse;
    const body = Buffer.from(JSON.stringify({ provider: 'openai', model: 'gpt-6-astra', mode: 'agent', question: 'q', stream: true }));
    const req = Object.assign(Readable.from([body]), { method: 'POST', url: '/api/chat', headers: { authorization: `Bearer ${TOKEN}` } }) as unknown as IncomingMessage;
    await router.dispatch(req, res, new URL('/api/chat', 'http://localhost'));

    const events = chunks.join('').trim().split('\n').map((line) => JSON.parse(line));
    expect(events.filter((e) => e.type === 'progress')).toEqual([
      { type: 'progress', stage: 'preparing' },
      { type: 'progress', stage: 'answering' },
      { type: 'progress', stage: 'agent-tool', detail: 'search_vault' },
    ]);
    expect(events.at(-1)).toMatchObject({ type: 'done', text: 'from the vault', mode: 'agent' });
  });
});
