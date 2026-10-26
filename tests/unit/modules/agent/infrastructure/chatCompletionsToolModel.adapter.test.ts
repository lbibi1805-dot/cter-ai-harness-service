import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import OpenAI from 'openai';
import { createOpenRouterToolModelFactory, type ToolCallingModel } from '../../../../../src/modules/agent';
import { AgentFallbackReason, AgentToolName, ModelTurnKind } from '../../../../../src/modules/agent/domain';
import { AIProvider, ConversationRole } from '../../../../../src/modules/ai';
import { FakeChatCompletionsServer } from '../../../../support/fakeChatCompletionsServer';
import { buildTestAiConfig, perProvider } from '../../../../support/configFixture';

const TOOLS = [{ name: AgentToolName.SEARCH_VAULT, description: 'search', parameters: { type: 'object', properties: { query: { type: 'string' } } } }];
const CONTENT = { textContent: 'What is a mutex?', imageBuffers: [] };
const PRIMARY = 'anthropic/claude-sonnet-4.5';
const TOOL_FALLBACK = 'anthropic/claude-haiku-4.5';
const NO_TOOLS_FALLBACK = 'some/text-only-model';

describe('ChatCompletionsToolModel via OpenRouter (real SDK against a fake OpenRouter)', () => {
  const server = new FakeChatCompletionsServer();
  let factory: ReturnType<typeof createOpenRouterToolModelFactory>;

  beforeAll(async () => {
    await server.start();
    server.toolModels = [PRIMARY, TOOL_FALLBACK];
    const config = buildTestAiConfig({
      openRouter: {
        ...buildTestAiConfig().openRouter,
        apiKey: 'or-key',
        baseUrl: server.baseURL,
        models: perProvider((provider) => (provider === AIProvider.CLAUDE ? PRIMARY : NO_TOOLS_FALLBACK)),
        fallbacks: perProvider((provider) => (provider === AIProvider.CLAUDE ? [TOOL_FALLBACK, NO_TOOLS_FALLBACK] : [])),
      },
    });
    const client = new OpenAI({ apiKey: 'or-key', baseURL: server.baseURL, maxRetries: 0 });
    factory = createOpenRouterToolModelFactory({ client, config, sleep: async () => undefined });
  });
  afterAll(() => server.stop());
  beforeEach(() => { server.requests.length = 0; });

  async function model(): Promise<ToolCallingModel> {
    const resolution = await factory(AIProvider.CLAUDE, 'claude-sonnet-4-6');
    if (!resolution.supported) throw new Error(`unsupported: ${resolution.reason}`);
    return resolution.model;
  }

  it('runs the provider\'s configured OpenRouter model, never the client\'s model name', async () => {
    server.responder = () => ({ text: 'ok' });
    await (await model()).startSession('s', CONTENT, TOOLS).next([], { allowTools: true });
    expect(server.requests[0].model).toBe(PRIMARY);
  });

  it('rejects a configured OpenRouter model that does not advertise tool support', async () => {
    await expect(factory(AIProvider.GEMINI, 'gemini-3.5-flash')).resolves.toEqual({ supported: false, reason: AgentFallbackReason.UNSUPPORTED_MODEL });
  });

  it('runs a tool-call round trip with the Chat Completions transcript', async () => {
    server.responder = (_body, i) => (i === 0
      ? { toolCalls: [{ name: AgentToolName.SEARCH_VAULT, arguments: { query: 'mutex' } }] }
      : { text: '# Answer', servedBy: TOOL_FALLBACK });
    const session = (await model()).startSession('system rules', CONTENT, TOOLS);

    const first = await session.next([], { allowTools: true, requireTool: true });
    expect(first).toEqual({
      kind: ModelTurnKind.TOOL_CALLS,
      calls: [{ id: 'call_1', name: AgentToolName.SEARCH_VAULT, arguments: '{"query":"mutex"}' }],
      usage: { inputTokens: 100, outputTokens: 20 },
    });
    const sent = server.requests[0];
    expect(sent.tool_choice).toBe('required');
    expect(sent.tools?.map((tool) => tool.function.name)).toEqual([AgentToolName.SEARCH_VAULT]);
    expect(sent.models).toEqual([PRIMARY, TOOL_FALLBACK]);

    const second = await session.next([{ callId: 'call_1', output: 'found: mutex has an owner' }], { allowTools: true });
    expect(second).toMatchObject({ kind: ModelTurnKind.FINAL, text: '# Answer', model: TOOL_FALLBACK });
    const followUp = server.requests[1].messages;
    expect(followUp.find((m) => m.role === 'assistant')).toMatchObject({ tool_calls: [{ id: 'call_1' }] });
    expect(followUp.find((m) => m.role === 'tool')).toEqual({ role: 'tool', tool_call_id: 'call_1', content: 'found: mutex has an owner' });
  });

  it('replays earlier conversation turns before the current question', async () => {
    server.responder = () => ({ text: 'ok' });
    const history = [{ role: ConversationRole.USER, text: 'What is a mutex?' }, { role: ConversationRole.ASSISTANT, text: 'A lock.' }];
    await (await model()).startSession('s', { ...CONTENT, textContent: 'What did I just ask?', history }, TOOLS).next([], { allowTools: true });
    expect(server.requests[0].messages).toEqual([
      { role: 'system', content: 's' },
      { role: 'user', content: 'What is a mutex?' },
      { role: 'assistant', content: 'A lock.' },
      { role: 'user', content: [{ type: 'text', text: 'What did I just ask?' }] },
    ]);
  });

  it('forces a text answer with tool_choice=none when tools are not allowed', async () => {
    server.responder = () => ({ text: 'forced answer' });
    const session = (await model()).startSession('s', CONTENT, TOOLS);
    await expect(session.next([], { allowTools: false })).resolves.toMatchObject({ kind: ModelTurnKind.FINAL, text: 'forced answer' });
    expect(server.requests[0].tool_choice).toBe('none');
  });

  it('retries transient HTTP errors and surfaces permanent ones', async () => {
    server.responder = (_b, i) => (i === 0 ? { status: 503, error: 'overloaded' } : { text: 'after retry' });
    await expect((await model()).startSession('s', CONTENT, TOOLS).next([], { allowTools: true })).resolves.toMatchObject({ text: 'after retry' });

    server.requests.length = 0;
    server.responder = () => ({ status: 400, error: 'bad tool schema' });
    await expect((await model()).startSession('s', CONTENT, TOOLS).next([], { allowTools: true })).rejects.toThrow(/400/);
    expect(server.requests).toHaveLength(1);
  });
});
