import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { classifyFailure, FailureKind } from '../../../../../src/shared/resilience';
import {
  AIProvider,
  ModelRoute,
  ConfiguredAIAdapterFactory,
  EmptyProviderResponseError,
  OPENROUTER_KEY_ENV,
  OpenRouterProviderSort,
} from '../../../../../src/modules/ai';
import { FakeChatCompletionsServer } from '../../../../support/fakeChatCompletionsServer';
import { buildTestAiConfig, perProvider } from '../../../../support/configFixture';

const CONTENT = { textContent: 'What is a mutex?', imageBuffers: [{ data: Buffer.from('png'), mimeType: 'image/png' }] };
const CLAUDE_PRIMARY = 'anthropic/claude-sonnet-4.5';
const CLAUDE_FALLBACKS = ['anthropic/claude-haiku-4.5', 'google/gemini-2.5-pro'];

describe('OpenRouter fallback adapter (real SDK against a fake OpenRouter)', () => {
  const server = new FakeChatCompletionsServer();
  let factory: ConfiguredAIAdapterFactory;

  beforeAll(async () => {
    await server.start();
    factory = new ConfiguredAIAdapterFactory(buildTestAiConfig({
      openRouter: {
        apiKey: 'or-key',
        baseUrl: server.baseURL,
        appUrl: 'https://cter.example',
        appTitle: 'CTER Harness',
        models: perProvider((provider) => (provider === AIProvider.CLAUDE ? CLAUDE_PRIMARY : `x/${provider}`)),
        fallbacks: perProvider((provider) => (provider === AIProvider.CLAUDE ? CLAUDE_FALLBACKS : [])),
        providerSort: OpenRouterProviderSort.THROUGHPUT,
        allowProviderFallbacks: true,
        maxTokens: 2048,
      },
    }));
  });
  afterAll(() => server.stop());
  beforeEach(() => {
    server.requests.length = 0;
    server.headers.length = 0;
  });

  it('offers OpenRouter for every provider once OPENROUTER_API_KEY is set, and nothing without it', () => {
    expect(factory.openRouter(AIProvider.GEMINI)).not.toBeNull();
    expect(factory.direct(AIProvider.GEMINI)).toBeNull();
    expect(factory.isConfigured(AIProvider.GEMINI)).toBe(true);
    expect(factory.credentialName(AIProvider.CLAUDE)).toContain(OPENROUTER_KEY_ENV);
    const withoutKey = new ConfiguredAIAdapterFactory(buildTestAiConfig());
    expect(withoutKey.openRouter(AIProvider.CLAUDE)).toBeNull();
    expect(withoutKey.isConfigured(AIProvider.CLAUDE)).toBe(false);
  });

  it('sends the fallback models, routing preferences, output cap and attribution headers', async () => {
    server.responder = () => ({ text: '# Answer' });
    const reply = await factory.openRouter(AIProvider.CLAUDE)!.process(CONTENT, 'system rules', CLAUDE_PRIMARY);

    expect(reply).toEqual({ text: '# Answer', model: CLAUDE_PRIMARY });
    const sent = server.requests[0];
    expect(sent.model).toBe(CLAUDE_PRIMARY);
    expect(sent.models).toEqual([CLAUDE_PRIMARY, ...CLAUDE_FALLBACKS]);
    expect(sent.provider).toEqual({ sort: OpenRouterProviderSort.THROUGHPUT, allow_fallbacks: true });
    expect(sent.max_tokens).toBe(2048);
    expect(sent.messages[0]).toEqual({ role: 'system', content: 'system rules' });
    expect(server.headers[0]['http-referer']).toBe('https://cter.example');
    expect(server.headers[0]['x-title']).toBe('CTER Harness');
    expect(server.headers[0].authorization).toBe('Bearer or-key');
  });

  it('reports the model OpenRouter fell back to', async () => {
    server.responder = () => ({ text: 'ok', servedBy: CLAUDE_FALLBACKS[1] });
    await expect(factory.openRouter(AIProvider.CLAUDE)!.process(CONTENT, 'sys', CLAUDE_PRIMARY))
      .resolves.toEqual({ text: 'ok', model: CLAUDE_FALLBACKS[1] });
  });

  it('omits `models` when the provider has no fallbacks', async () => {
    server.responder = () => ({ text: 'ok' });
    await factory.openRouter(AIProvider.GEMINI)!.process(CONTENT, 'sys', 'x/gemini');
    expect(server.requests[0].models).toBeUndefined();
  });

  it('turns an in-body error (HTTP 200) into a classified failure', async () => {
    server.responder = () => ({ bodyError: { code: 402, message: 'Insufficient credits' } });
    const err = await factory.openRouter(AIProvider.CLAUDE)!.process(CONTENT, 'sys', CLAUDE_PRIMARY).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(EmptyProviderResponseError);
    expect(classifyFailure(err)).toBe(FailureKind.FATAL);
  });

  it('treats a reply without choices as transient', async () => {
    server.responder = () => ({ noChoices: true });
    const err = await factory.openRouter(AIProvider.CLAUDE)!.process(CONTENT, 'sys', CLAUDE_PRIMARY).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(EmptyProviderResponseError);
    expect(classifyFailure(err)).toBe(FailureKind.TRANSIENT);
  });

  it('classifies HTTP 402 as fatal and 403 (moderation) as permanent', async () => {
    server.responder = () => ({ status: 402, error: 'Insufficient credits' });
    expect(classifyFailure(await factory.openRouter(AIProvider.CLAUDE)!.process(CONTENT, 'sys', CLAUDE_PRIMARY).catch((e: unknown) => e))).toBe(FailureKind.FATAL);
    server.responder = () => ({ status: 403, error: 'flagged by moderation' });
    expect(classifyFailure(await factory.openRouter(AIProvider.CLAUDE)!.process(CONTENT, 'sys', CLAUDE_PRIMARY).catch((e: unknown) => e))).toBe(FailureKind.PERMANENT);
  });

  it('validates the single OpenRouter key instead of one key per provider', async () => {
    server.toolModels = [CLAUDE_PRIMARY];
    await expect(factory.validateKeys()).resolves.toEqual([{ provider: ModelRoute.OPENROUTER, ok: true }]);
  });
});
