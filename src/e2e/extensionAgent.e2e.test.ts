// Contract + connection tests between the browser extension and this backend.
// Loads the extension's REAL modules (lib/messageFormat.js, lib/canvasApi.js) from the
// sibling repo and drives the full loop: extension posts [CFH:REQUEST] to Canvas →
// backend ConversationPoller answers (agent / fallback) → extension reads the reply.
// Skipped when the extension repo is not checked out next to this one.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { ALLOWED_MODELS, getModelApiMode } from '../config/allowedModels';
import { AgentToolName, AnswerMode } from '../modules/agent';
import { buildReply, parseRequest } from '../utils/conversationMessageParser';
import { SINGLE_SHOT_ANSWER, startAgentConversationHarness, type AgentConversationHarness } from './agentConversationHarness';
import { ACTIVE_CONVERSATION_ID } from './fakeCanvasServer';

const EXTENSION_DIR = path.resolve(__dirname, '..', '..', '..', 'cter-browser-extension-client');
const hasExtension = fs.existsSync(path.join(EXTENSION_DIR, 'lib', 'messageFormat.js'));

/* eslint-disable @typescript-eslint/no-explicit-any */
let ext: any;
let canvasApi: any;

async function loadExtension(): Promise<void> {
  ext = await import(pathToFileURL(path.join(EXTENSION_DIR, 'lib', 'messageFormat.js')).href);
  canvasApi = await import(pathToFileURL(path.join(EXTENSION_DIR, 'lib', 'canvasApi.js')).href);
}

describe.skipIf(!hasExtension)('extension ↔ backend contract', () => {
  beforeAll(loadExtension);

  it('mode values are identical on both sides', () => {
    expect(ext.ANSWER_MODES.SINGLE_SHOT).toBe(AnswerMode.SINGLE_SHOT);
    expect(ext.ANSWER_MODES.AGENT).toBe(AnswerMode.AGENT);
  });

  it("the extension's agent-capable models are exactly the backend's Responses-API models", () => {
    const backendAgentModels = ALLOWED_MODELS.openai.filter((m) => getModelApiMode('openai', m) === 'responses').sort();
    expect([...ext.AGENT_CAPABLE_MODELS.openai].sort()).toEqual(backendAgentModels);
    expect(Object.keys(ext.AGENT_CAPABLE_MODELS)).toEqual(['openai']);
  });

  it('extension agent request → backend parses mode: agent', () => {
    const parsed = parseRequest(ext.buildRequestBody('openai', 'gpt-6-astra', 'Compare mutex and semaphore', ext.ANSWER_MODES.AGENT));
    expect(parsed).toMatchObject({ valid: true, provider: 'openai', model: 'gpt-6-astra', question: 'Compare mutex and semaphore', mode: AnswerMode.AGENT });
  });

  it('extension single-shot request → backend parses single-shot (unchanged legacy body)', () => {
    expect(parseRequest(ext.buildRequestBody('gemini', 'gemini-3.5-flash', 'Q?')).mode).toBe(AnswerMode.SINGLE_SHOT);
  });

  it('backend reply → extension reads the answered mode and model', () => {
    const agentReply = ext.parseReplyMessage(buildReply({ requestId: 42, status: 'done', provider: 'openai', model: 'gpt-6-astra', content: '# A', mode: AnswerMode.AGENT }));
    expect(agentReply).toMatchObject({ requestId: 42, status: 'done', model: 'gpt-6-astra', mode: ext.ANSWER_MODES.AGENT, content: '# A' });
    const plainReply = ext.parseReplyMessage(buildReply({ requestId: 43, status: 'done', provider: 'openai', model: 'gpt-6-astra', content: 'x', mode: AnswerMode.SINGLE_SHOT }));
    expect(plainReply.mode).toBe(ext.ANSWER_MODES.SINGLE_SHOT);
  });
});

describe.skipIf(!hasExtension)('extension ↔ Canvas ↔ backend connection (agent mode)', () => {
  let h: AgentConversationHarness;

  /** The extension's own network code: what the popup does on Send and on reload. */
  const extensionSend = (question: string, provider: string, model: string, agentEnabled: boolean) =>
    canvasApi.addMessageWithAttachments(h.canvas.baseUrl, 'token', ACTIVE_CONVERSATION_ID,
      ext.buildRequestBody(provider, model, question, ext.resolveRequestMode(agentEnabled, provider, model)), []);
  const extensionView = async () => ext.deriveRequestStatuses(await canvasApi.listMessages(h.canvas.baseUrl, 'token', ACTIVE_CONVERSATION_ID));

  beforeAll(async () => {
    await loadExtension();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    h = await startAgentConversationHarness();
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await h.stop();
  });

  it('toggle ON + gpt-6-astra: the agent researches and the extension shows an agent answer', async () => {
    h.openai.requests.length = 0;
    h.openai.responder = (_b, i) => (i === 0
      ? { functionCall: { name: AgentToolName.SEARCH_VAULT, arguments: { query: 'semaphore' } } }
      : { text: `Agent: ${h.openai.lastToolOutputs()[0]?.includes('sem_wait blocks at zero') ? 'used the vault' : 'no evidence'}` });

    await extensionSend('What happens when sem_wait is called at zero?', 'openai', 'gpt-6-astra', true);
    expect((await extensionView()).at(-1)).toMatchObject({ status: 'pending', requestedMode: 'agent', answeredMode: null });

    await h.poll();

    const answered = (await extensionView()).at(-1);
    expect(answered).toMatchObject({ status: 'done', requestedMode: 'agent', answeredMode: 'agent', answeredModel: 'gpt-6-astra', reply: 'Agent: used the vault' });
    expect(ext.describeAnswerMode(answered)).toEqual({ kind: 'agent', text: 'agent' });
    expect(h.openai.requests).toHaveLength(2);
    expect(h.singleShot).not.toHaveBeenCalled();
  });

  it('toggle ON + a non-agent model: the extension sends single-shot (no mode header at all)', async () => {
    await extensionSend('Plain question', 'openai', 'gpt-4o', true);
    const sent = h.canvas.conversation.at(-1)!.body;
    expect(sent).not.toContain('mode:');

    await h.poll();
    const answered = (await extensionView()).at(-1);
    expect(answered).toMatchObject({ status: 'done', requestedMode: 'single-shot', answeredMode: 'single-shot', reply: SINGLE_SHOT_ANSWER });
    expect(ext.describeAnswerMode(answered)).toBeNull();
  });

  it('toggle OFF: single-shot even for an agent-capable model', async () => {
    h.openai.requests.length = 0;
    await extensionSend('Toggle off', 'openai', 'gpt-6-astra', false);
    await h.poll();
    expect((await extensionView()).at(-1)).toMatchObject({ requestedMode: 'single-shot', answeredMode: 'single-shot' });
    expect(h.openai.requests).toHaveLength(0);
  });

  it('agent failure on the backend: the extension still gets an answer, tagged as a fallback', async () => {
    h.openai.responder = () => ({ status: 400, error: 'tool schema rejected' });
    await extensionSend('Agent will fail', 'openai', 'gpt-5.3-codex', true);
    await h.poll();

    const answered = (await extensionView()).at(-1);
    expect(answered).toMatchObject({ status: 'done', requestedMode: 'agent', answeredMode: 'single-shot', reply: SINGLE_SHOT_ANSWER });
    expect(ext.describeAnswerMode(answered)).toEqual({ kind: 'fallback', text: 'agent → single-shot' });
  });

  it('every request got exactly one reply (no duplicates across polls)', async () => {
    await h.poll();
    const view = await extensionView();
    expect(view.every((r: { status: string }) => r.status === 'done')).toBe(true);
    const replies = h.canvas.conversation.filter((m) => m.body.startsWith('[CFH:REPLY]'));
    expect(replies).toHaveLength(view.length);
  });
});
