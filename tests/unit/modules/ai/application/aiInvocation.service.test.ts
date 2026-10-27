import { describe, it, expect, vi } from 'vitest';
import { FailureKind } from '../../../../../src/shared/resilience';
import {
  AIInvocationError,
  AIInvocationService,
  AIProvider,
  ModelCatalog,
  ModelRoute,
  PromptPreparer,
  RATE_LIMIT_ATTEMPTS_PER_MODEL,
  type AIAdapter,
  type AIAdapterFactory,
  type AIInvocationSettings,
  type PromptContent,
} from '../../../../../src/modules/ai';
import { buildTestAiConfig, perProvider } from '../../../../support/configFixture';

const CONTENT: PromptContent = { textContent: 'What is a mutex?', imageBuffers: [] };
const GEMINI_FALLBACKS = ['g-2', 'g-3'];
const OPENROUTER_GEMINI = 'google/gemini-2.5-flash';

function settings(overrides: Partial<AIInvocationSettings> = {}): AIInvocationSettings {
  return { maxRetryCount: 3, timeoutMs: 1000, ...overrides };
}

function catalog(openRouterKey?: string): ModelCatalog {
  const base = buildTestAiConfig();
  return new ModelCatalog(buildTestAiConfig({
    modelFallback: perProvider((provider) => (provider === AIProvider.GEMINI ? GEMINI_FALLBACKS : [])),
    openRouter: { ...base.openRouter, apiKey: openRouterKey, models: perProvider(() => OPENROUTER_GEMINI) },
  }));
}

function httpError(status: number) {
  return Object.assign(new Error(`HTTP ${status}`), { status });
}

function factoryFor(direct: AIAdapter | null, openRouter: AIAdapter | null = null): AIAdapterFactory {
  return { direct: () => direct, openRouter: () => openRouter, credentialName: () => 'GEMINI_API_KEY (or OPENROUTER_API_KEY)' };
}

/** Adapter whose behaviour is scripted per model: an array of results/errors consumed in order. */
function scriptedAdapter(script: Record<string, Array<string | Error>>) {
  const calls: string[] = [];
  const adapter: AIAdapter = {
    validate: async () => undefined,
    process: async (_content, _system, model) => {
      calls.push(model);
      const next = script[model]?.shift();
      if (next === undefined) throw new Error(`no script for ${model}`);
      if (next instanceof Error) throw next;
      return { text: next, model };
    },
  };
  return { adapter, calls };
}

function service(adapters: AIAdapterFactory, s = settings(), openRouterKey?: string) {
  const sleep = vi.fn().mockResolvedValue(undefined);
  const prompts = new PromptPreparer('sys', '');
  const prepare = vi.spyOn(prompts, 'prepare');
  const svc = new AIInvocationService(s, catalog(openRouterKey), prompts, adapters, { sleep });
  return { svc, sleep, prepare };
}

const ask = (model = 'g-1') => ({ provider: AIProvider.GEMINI, model, content: CONTENT, label: 'f' });
const fail = () => [httpError(500), httpError(500), httpError(500), httpError(500)];

describe('AIInvocationService — direct route', () => {
  it('returns the first successful answer', async () => {
    const { adapter } = scriptedAdapter({ 'g-1': ['# answer'] });
    const { svc } = service(factoryFor(adapter));
    await expect(svc.answer(ask())).resolves.toEqual({ text: '# answer', model: 'g-1', attempts: 1, contexts: [], route: ModelRoute.DIRECT });
  });

  it('retries transient errors on the same model with exponential backoff', async () => {
    const { adapter, calls } = scriptedAdapter({ 'g-1': [httpError(503), httpError(500), 'ok'] });
    const { svc, sleep } = service(factoryFor(adapter));
    const answer = await svc.answer(ask());
    expect(answer).toMatchObject({ model: 'g-1', attempts: 3 });
    expect(calls).toEqual(['g-1', 'g-1', 'g-1']);
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([1000, 2000]);
  });

  it(`moves to the next model after ${RATE_LIMIT_ATTEMPTS_PER_MODEL} rate-limited attempts`, async () => {
    const { adapter, calls } = scriptedAdapter({ 'g-1': [httpError(429), httpError(429)], 'g-2': ['from fallback'] });
    const { svc } = service(factoryFor(adapter));
    expect(await svc.answer(ask())).toMatchObject({ text: 'from fallback', model: 'g-2', attempts: 3 });
    expect(calls).toEqual(['g-1', 'g-1', 'g-2']);
  });

  it('skips a model immediately on a permanent error', async () => {
    const { adapter, calls } = scriptedAdapter({ 'g-1': [httpError(404)], 'g-2': ['ok'] });
    const { svc, sleep } = service(factoryFor(adapter));
    await svc.answer(ask());
    expect(calls).toEqual(['g-1', 'g-2']);
    expect(sleep).not.toHaveBeenCalled();
  });

  it.each([401, 402])('stops the direct chain on a fatal %i error', async (status) => {
    const { adapter, calls } = scriptedAdapter({ 'g-1': [httpError(status)], 'g-2': ['never'] });
    const { svc } = service(factoryFor(adapter));
    const err = await svc.answer(ask()).catch((e) => e);
    expect(err).toBeInstanceOf(AIInvocationError);
    expect(err.kind).toBe(FailureKind.FATAL);
    expect(calls).toEqual(['g-1']);
  });

  it('reports missing credentials as fatal without calling any model', async () => {
    const svc = new AIInvocationService(settings(), catalog(), new PromptPreparer('sys', ''), factoryFor(null));
    const err = await svc.answer(ask()).catch((e) => e);
    expect(err).toMatchObject({ kind: FailureKind.FATAL, attempts: 0, message: 'GEMINI_API_KEY (or OPENROUTER_API_KEY) not configured' });
  });

  it('throws with the last error after the whole chain is exhausted', async () => {
    const { adapter, calls } = scriptedAdapter({ 'g-1': fail(), 'g-2': fail(), 'g-3': fail() });
    const { svc } = service(factoryFor(adapter));
    const err = await svc.answer(ask()).catch((e) => e);
    expect(err).toMatchObject({ kind: FailureKind.TRANSIENT, attempts: 12, lastModel: 'g-3', message: 'HTTP 500' });
    expect(calls).toHaveLength(12);
  });

  it('prepares the prompt once, not once per attempt', async () => {
    const { adapter } = scriptedAdapter({ 'g-1': [httpError(503), httpError(503), 'ok'] });
    const { svc, prepare } = service(factoryFor(adapter));
    await svc.answer(ask());
    expect(prepare).toHaveBeenCalledTimes(1);
  });

  it('times out a hung model call and treats it as transient', async () => {
    const adapter: AIAdapter = {
      validate: async () => undefined,
      process: vi.fn()
        .mockImplementationOnce(() => new Promise(() => undefined))
        .mockResolvedValue({ text: 'after timeout', model: 'g-1' }),
    };
    const { svc } = service(factoryFor(adapter), settings({ timeoutMs: 20 }));
    await expect(svc.answer(ask())).resolves.toMatchObject({ text: 'after timeout', attempts: 2 });
  });
});

describe('AIInvocationService — OpenRouter fallback (backend-only)', () => {
  it('falls back to OpenRouter after the direct chain is exhausted', async () => {
    const direct = scriptedAdapter({ 'g-1': fail(), 'g-2': fail(), 'g-3': fail() });
    const openRouter = scriptedAdapter({ [OPENROUTER_GEMINI]: ['from openrouter'] });
    const { svc } = service(factoryFor(direct.adapter, openRouter.adapter), settings(), 'or-key');
    const answer = await svc.answer(ask());
    expect(answer).toMatchObject({ text: 'from openrouter', model: OPENROUTER_GEMINI, route: ModelRoute.OPENROUTER, attempts: 13 });
    expect(openRouter.calls).toEqual([OPENROUTER_GEMINI]);
  });

  it('falls back to OpenRouter after a fatal direct error (bad or unpaid key)', async () => {
    const direct = scriptedAdapter({ 'g-1': [httpError(401)] });
    const openRouter = scriptedAdapter({ [OPENROUTER_GEMINI]: ['ok'] });
    const { svc } = service(factoryFor(direct.adapter, openRouter.adapter), settings(), 'or-key');
    await expect(svc.answer(ask())).resolves.toMatchObject({ route: ModelRoute.OPENROUTER });
  });

  it('serves a provider without a direct key through OpenRouter only', async () => {
    const openRouter = scriptedAdapter({ [OPENROUTER_GEMINI]: ['ok'] });
    const { svc } = service(factoryFor(null, openRouter.adapter), settings(), 'or-key');
    await expect(svc.answer(ask())).resolves.toMatchObject({ model: OPENROUTER_GEMINI, route: ModelRoute.OPENROUTER, attempts: 1 });
  });

  it('never calls OpenRouter while the direct route succeeds', async () => {
    const direct = scriptedAdapter({ 'g-1': ['direct'] });
    const openRouter = scriptedAdapter({});
    const { svc } = service(factoryFor(direct.adapter, openRouter.adapter), settings(), 'or-key');
    await expect(svc.answer(ask())).resolves.toMatchObject({ route: ModelRoute.DIRECT });
    expect(openRouter.calls).toEqual([]);
  });

  it('reports attempts across both routes when OpenRouter fails too', async () => {
    const direct = scriptedAdapter({ 'g-1': [httpError(401)] });
    const openRouter = scriptedAdapter({ [OPENROUTER_GEMINI]: [httpError(402)] });
    const { svc } = service(factoryFor(direct.adapter, openRouter.adapter), settings(), 'or-key');
    await expect(svc.answer(ask())).rejects.toMatchObject({ kind: FailureKind.FATAL, attempts: 2, lastModel: OPENROUTER_GEMINI });
  });
});

describe('AIInvocationService — answerPrepared', () => {
  it('sends the caller-built system prompt and content without preparing a prompt', async () => {
    const seen: Array<[string, string]> = [];
    const adapter: AIAdapter = {
      validate: async () => undefined,
      process: async (content, system, model) => {
        seen.push([content.textContent, system]);
        return { text: '{"ok":true}', model };
      },
    };
    const { svc, prepare } = service(factoryFor(adapter));
    const content = { textContent: 'draw it', imageBuffers: [] };
    const answer = await svc.answerPrepared({ ...ask(), content }, { systemPrompt: 'c4 architect', content, contexts: [] });
    expect(answer).toMatchObject({ text: '{"ok":true}', model: 'g-1', route: ModelRoute.DIRECT });
    expect(seen).toEqual([['draw it', 'c4 architect']]);
    expect(prepare).not.toHaveBeenCalled();
  });
});

describe('AIInvocationService — streaming', () => {
  it('relays deltas and resets the stream before a retry that follows partial text', async () => {
    let call = 0;
    const adapter: AIAdapter = {
      validate: async () => undefined,
      process: async (_content, _system, model, onDelta) => {
        call++;
        onDelta?.(`part${call}`);
        if (call === 1) throw httpError(503);
        return { text: `part${call}`, model };
      },
    };
    const events: string[] = [];
    const { svc } = service(factoryFor(adapter));
    const answer = await svc.answer({ ...ask(), stream: { delta: (t) => events.push(t), reset: () => events.push('<reset>') } });
    expect(events).toEqual(['part1', '<reset>', 'part2']);
    expect(answer.text).toBe('part2');
  });
});
