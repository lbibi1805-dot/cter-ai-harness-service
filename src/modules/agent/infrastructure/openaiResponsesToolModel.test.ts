import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FakeOpenAIResponsesServer } from '../../../e2e/fakeOpenAIResponsesServer';
import { AgentToolName, ModelTurnKind } from '../domain';
import { createOpenAIToolModelFactory } from './openaiResponsesToolModel';

const TOOLS = [{ name: AgentToolName.SEARCH_VAULT, description: 'search', parameters: { type: 'object', properties: { query: { type: 'string' } } } }];
const CONTENT = { textContent: 'What is a mutex?', imageBuffers: [{ data: Buffer.from('png'), mimeType: 'image/png' }] };

describe('OpenAIResponsesToolModel (real SDK against a fake Responses server)', () => {
  const server = new FakeOpenAIResponsesServer();
  let factory: ReturnType<typeof createOpenAIToolModelFactory>;

  beforeAll(async () => {
    await server.start();
    factory = createOpenAIToolModelFactory({ apiKey: 'test', timeoutMs: 5000, baseURL: server.baseURL, sleep: async () => undefined });
  });
  afterAll(() => server.stop());
  beforeEach(() => { server.requests.length = 0; });

  it('only supports OpenAI models in Responses API mode', () => {
    expect(factory('openai', 'gpt-6-astra')).not.toBeNull();
    expect(factory('openai', 'gpt-5.3-codex')).not.toBeNull();
    expect(factory('openai', 'gpt-4o')).toBeNull();
    expect(factory('gemini', 'gemini-3.5-flash')).toBeNull();
  });

  it('runs a function-call round trip and keeps the transcript', async () => {
    server.responder = (_body, i) => (i === 0
      ? { functionCall: { name: AgentToolName.SEARCH_VAULT, arguments: { query: 'mutex' } } }
      : { text: '# Answer' });
    const session = factory('openai', 'gpt-6-astra')!.startSession('system rules', CONTENT, TOOLS);

    const first = await session.next([], { allowTools: true });
    expect(first).toEqual({
      kind: ModelTurnKind.TOOL_CALLS,
      calls: [{ id: 'call_1', name: AgentToolName.SEARCH_VAULT, arguments: '{"query":"mutex"}' }],
      usage: { inputTokens: 100, outputTokens: 20 },
    });
    const sent = server.requests[0];
    expect(sent.model).toBe('gpt-6-astra');
    expect(sent.tool_choice).toBe('auto');
    expect(sent.tools?.map((t) => t.name)).toEqual([AgentToolName.SEARCH_VAULT]);
    expect(JSON.stringify(sent.input)).toContain('input_image');

    const second = await session.next([{ callId: 'call_1', output: 'found: mutex has an owner' }], { allowTools: true });
    expect(second).toMatchObject({ kind: ModelTurnKind.FINAL, text: '# Answer' });
    const followUp = server.requests[1].input;
    expect(followUp.find((i) => i.type === 'function_call')).toMatchObject({ call_id: 'call_1' });
    expect(followUp.find((i) => i.type === 'function_call_output')).toEqual({ type: 'function_call_output', call_id: 'call_1', output: 'found: mutex has an owner' });
  });

  it('forces a text answer with tool_choice=none when tools are not allowed', async () => {
    server.responder = () => ({ text: 'forced answer' });
    const session = factory('openai', 'gpt-6-astra')!.startSession('s', CONTENT, TOOLS);
    await expect(session.next([], { allowTools: false })).resolves.toMatchObject({ kind: ModelTurnKind.FINAL, text: 'forced answer' });
    expect(server.requests[0].tool_choice).toBe('none');
  });

  it('retries transient HTTP errors (SDK retries are disabled)', async () => {
    server.responder = (_b, i) => (i === 0 ? { status: 503, error: 'overloaded' } : { text: 'after retry' });
    const session = factory('openai', 'gpt-6-astra')!.startSession('s', CONTENT, TOOLS);
    await expect(session.next([], { allowTools: true })).resolves.toMatchObject({ text: 'after retry' });
    expect(server.requests).toHaveLength(2);
  });

  it('surfaces permanent errors without retrying', async () => {
    server.responder = () => ({ status: 400, error: 'bad tool schema' });
    const session = factory('openai', 'gpt-6-astra')!.startSession('s', CONTENT, TOOLS);
    await expect(session.next([], { allowTools: true })).rejects.toThrow(/400/);
    expect(server.requests).toHaveLength(1);
  });
});
