// Contract + connection tests between the WPF client (cter-interview-cloak-client) and
// this backend, across languages: the C# MessageFormat + CanvasApiService are compiled
// (tests/ProtocolTests console project) and driven as a CLI over real HTTP against the
// fake Canvas, while the REAL ConversationPoller + agent answer in between.
// Skipped when the WPF repo or the .NET SDK is not available.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync, execFile } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';
import { ALLOWED_MODELS, getModelApiMode } from '../config/allowedModels';
import { AgentToolName, AnswerMode } from '../modules/agent';
import { buildReply, parseRequest } from '../utils/conversationMessageParser';
import { SINGLE_SHOT_ANSWER, startAgentConversationHarness, type AgentConversationHarness } from './agentConversationHarness';
import { ACTIVE_CONVERSATION_ID } from './fakeCanvasServer';

const run = promisify(execFile);
const PROJECT = path.resolve(__dirname, '..', '..', '..', 'cter-interview-cloak-client', 'tests', 'ProtocolTests', 'ProtocolTests.csproj');

function hasDotnet(): boolean {
  try {
    execFileSync('dotnet', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
const available = fs.existsSync(PROJECT) && hasDotnet();

interface WpfViewItem {
  requestId: number;
  question: string;
  status: string;
  requestedMode: string;
  answeredMode: string | null;
  answeredModel: string | null;
  reply: string | null;
  tag: { kind: string; text: string } | null;
}

describe.skipIf(!available)('WPF client ↔ Canvas ↔ backend (C# over real HTTP)', () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wpf-protocol-'));
  let h: AgentConversationHarness;

  const cs = async (...args: string[]) => (await run('dotnet', [path.join(outDir, 'ProtocolTests.dll'), ...args])).stdout;
  const wpfSend = (question: string, provider: string, model: string, agentEnabled: boolean) =>
    cs('send', h.canvas.baseUrl, 'token', String(ACTIVE_CONVERSATION_ID), provider, model, String(agentEnabled), question);
  const wpfView = async (): Promise<WpfViewItem[]> => JSON.parse(await cs('view', h.canvas.baseUrl, 'token', String(ACTIVE_CONVERSATION_ID)));

  beforeAll(async () => {
    execFileSync('dotnet', ['build', PROJECT, '-o', outDir, '-nologo', '-v', 'q'], { stdio: 'ignore' });
    h = await startAgentConversationHarness();
  }, 300_000);

  afterAll(async () => {
    await h?.stop();
    fs.rmSync(outDir, { recursive: true, force: true });
  });

  describe('contract', () => {
    it("C#'s agent-capable models are exactly the backend's Responses-API models", async () => {
      const csModels = JSON.parse(await cs('agent-models')) as Record<string, string[]>;
      const backend = ALLOWED_MODELS.openai.filter((m) => getModelApiMode('openai', m) === 'responses').sort();
      expect(Object.keys(csModels)).toEqual(['openai']);
      expect([...csModels.openai].sort()).toEqual(backend);
    });

    it('C# agent request body → backend parses mode: agent', async () => {
      const parsed = parseRequest(await cs('build', 'openai', 'gpt-6-astra', 'true', 'Compare mutex and semaphore'));
      expect(parsed).toMatchObject({ valid: true, provider: 'openai', model: 'gpt-6-astra', question: 'Compare mutex and semaphore', mode: AnswerMode.AGENT });
    });

    it('C# with toggle on but a non-agent model → backend sees single-shot', async () => {
      expect(parseRequest(await cs('build', 'openai', 'gpt-4o', 'true', 'Q?')).mode).toBe(AnswerMode.SINGLE_SHOT);
    });

    it('backend replies → C# reads mode and model', async () => {
      const encode = (body: string) => Buffer.from(body, 'utf-8').toString('base64');
      const agent = JSON.parse(await cs('parse-reply', encode(buildReply({ requestId: 7, status: 'done', provider: 'openai', model: 'gpt-6-astra', content: 'A', mode: AnswerMode.AGENT }))));
      expect(agent).toMatchObject({ requestId: 7, status: 'done', model: 'gpt-6-astra', mode: 'agent', content: 'A' });
      const plain = JSON.parse(await cs('parse-reply', encode(buildReply({ requestId: 8, status: 'done', provider: 'openai', model: 'gpt-4o', content: 'B' }))));
      expect(plain.mode).toBe('single-shot');
    });
  });

  describe('connection', () => {
    it('agent ON: C# sends → backend agent researches → C# shows an agent answer', async () => {
      h.openai.requests.length = 0;
      h.openai.responder = (_b, i) => (i === 0
        ? { functionCall: { name: AgentToolName.SEARCH_VAULT, arguments: { query: 'semaphore' } } }
        : { text: `Agent: ${h.openai.lastToolOutputs()[0]?.includes('sem_wait blocks at zero') ? 'used the vault' : 'no evidence'}` });

      await wpfSend('What happens when sem_wait is called at zero?', 'openai', 'gpt-6-astra', true);
      expect((await wpfView()).at(-1)).toMatchObject({ status: 'pending', requestedMode: 'agent', answeredMode: null });

      await h.poll();

      expect((await wpfView()).at(-1)).toMatchObject({
        status: 'done', requestedMode: 'agent', answeredMode: 'agent', answeredModel: 'gpt-6-astra',
        reply: 'Agent: used the vault', tag: { kind: 'agent', text: 'agent' },
      });
      expect(h.openai.requests).toHaveLength(2);
    }, 60_000);

    it('agent OFF: single-shot, OpenAI tool endpoint never called', async () => {
      h.openai.requests.length = 0;
      await wpfSend('Toggle off', 'openai', 'gpt-6-astra', false);
      await h.poll();
      expect((await wpfView()).at(-1)).toMatchObject({ requestedMode: 'single-shot', answeredMode: 'single-shot', reply: SINGLE_SHOT_ANSWER, tag: null });
      expect(h.openai.requests).toHaveLength(0);
    }, 60_000);

    it('agent failure: C# still gets an answer, tagged as a fallback', async () => {
      h.openai.responder = () => ({ status: 400, error: 'tool schema rejected' });
      await wpfSend('Agent will fail', 'openai', 'gpt-5.3-codex', true);
      await h.poll();
      expect((await wpfView()).at(-1)).toMatchObject({
        status: 'done', requestedMode: 'agent', answeredMode: 'single-shot', reply: SINGLE_SHOT_ANSWER,
        tag: { kind: 'fallback', text: 'agent → single-shot' },
      });
    }, 60_000);

    it('exactly one reply per request', async () => {
      await h.poll();
      const view = await wpfView();
      expect(view.every((r) => r.status === 'done')).toBe(true);
      expect(h.canvas.conversation.filter((m) => m.body.startsWith('[CFH:REPLY]'))).toHaveLength(view.length);
    }, 60_000);
  });
});
