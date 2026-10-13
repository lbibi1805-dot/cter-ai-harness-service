import { describe, it, expect, vi } from 'vitest';
import { FailureKind } from '../../../shared/resilience';
import type { AIAdapter, AppConfig, FileContent } from '../../../types';
import { AIInvocationError } from '../domain/aiInvocationError';
import { buildModelChain } from '../domain/modelChain';
import { AIInvocationService, RATE_LIMIT_ATTEMPTS_PER_MODEL, type AIInvocationSettings } from './aiInvocation.service';
import { PromptPreparer } from './promptPreparer';

const CONTENT: FileContent = { textContent: 'What is a mutex?', imageBuffers: [] };

function settings(overrides: Partial<AIInvocationSettings> = {}): AIInvocationSettings {
  return {
    aiKeys: { gemini: 'k', openai: 'k' },
    grokBaseUrl: '',
    modelFallback: { claude: [], gemini: ['g-2', 'g-3'], grok: [], openai: [] } as AppConfig['modelFallback'],
    maxRetryCount: 3,
    aiTimeoutMs: 1000,
    ...overrides,
  };
}

function httpError(status: number) {
  return Object.assign(new Error(`HTTP ${status}`), { status });
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
      return next;
    },
  };
  return { adapter, calls };
}

function service(adapter: AIAdapter, s = settings()) {
  const sleep = vi.fn().mockResolvedValue(undefined);
  const prompts = new PromptPreparer('sys', '');
  const prepare = vi.spyOn(prompts, 'prepare');
  const svc = new AIInvocationService(s, prompts, { createAdapter: () => adapter, sleep });
  return { svc, sleep, prepare };
}

describe('AIInvocationService', () => {
  it('returns the first successful answer', async () => {
    const { adapter } = scriptedAdapter({ 'g-1': ['# answer'] });
    const { svc } = service(adapter);
    await expect(svc.answer({ provider: 'gemini', model: 'g-1', content: CONTENT, label: 'f' }))
      .resolves.toEqual({ text: '# answer', model: 'g-1', attempts: 1 });
  });

  it('retries transient errors on the same model with exponential backoff', async () => {
    const { adapter, calls } = scriptedAdapter({ 'g-1': [httpError(503), httpError(500), 'ok'] });
    const { svc, sleep } = service(adapter);
    const answer = await svc.answer({ provider: 'gemini', model: 'g-1', content: CONTENT, label: 'f' });
    expect(answer).toMatchObject({ model: 'g-1', attempts: 3 });
    expect(calls).toEqual(['g-1', 'g-1', 'g-1']);
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([1000, 2000]);
  });

  it(`moves to the next model after ${RATE_LIMIT_ATTEMPTS_PER_MODEL} rate-limited attempts`, async () => {
    const { adapter, calls } = scriptedAdapter({ 'g-1': [httpError(429), httpError(429)], 'g-2': ['from fallback'] });
    const { svc } = service(adapter);
    const answer = await svc.answer({ provider: 'gemini', model: 'g-1', content: CONTENT, label: 'f' });
    expect(answer).toEqual({ text: 'from fallback', model: 'g-2', attempts: 3 });
    expect(calls).toEqual(['g-1', 'g-1', 'g-2']);
  });

  it('skips a model immediately on a permanent error', async () => {
    const { adapter, calls } = scriptedAdapter({ 'g-1': [httpError(404)], 'g-2': ['ok'] });
    const { svc, sleep } = service(adapter);
    await svc.answer({ provider: 'gemini', model: 'g-1', content: CONTENT, label: 'f' });
    expect(calls).toEqual(['g-1', 'g-2']);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('stops the whole chain on a fatal error', async () => {
    const { adapter, calls } = scriptedAdapter({ 'g-1': [httpError(401)], 'g-2': ['never'] });
    const { svc } = service(adapter);
    const err = await svc.answer({ provider: 'gemini', model: 'g-1', content: CONTENT, label: 'f' }).catch((e) => e);
    expect(err).toBeInstanceOf(AIInvocationError);
    expect(err.kind).toBe(FailureKind.FATAL);
    expect(calls).toEqual(['g-1']);
  });

  it('reports a missing API key as fatal without calling any model', async () => {
    const prompts = new PromptPreparer('sys', '');
    const svc = new AIInvocationService(settings(), prompts, {
      createAdapter: () => { throw new Error('GEMINI_API_KEY not configured'); },
    });
    const err = await svc.answer({ provider: 'gemini', model: 'g-1', content: CONTENT, label: 'f' }).catch((e) => e);
    expect(err).toMatchObject({ kind: FailureKind.FATAL, attempts: 0, message: 'GEMINI_API_KEY not configured' });
  });

  it('throws with the last error after the whole chain is exhausted', async () => {
    const fail = () => [httpError(500), httpError(500), httpError(500), httpError(500)];
    const { adapter, calls } = scriptedAdapter({ 'g-1': fail(), 'g-2': fail(), 'g-3': fail() });
    const { svc } = service(adapter);
    const err = await svc.answer({ provider: 'gemini', model: 'g-1', content: CONTENT, label: 'f' }).catch((e) => e);
    expect(err).toMatchObject({ kind: FailureKind.TRANSIENT, attempts: 12, lastModel: 'g-3', message: 'HTTP 500' });
    expect(calls).toHaveLength(12);
  });

  it('prepares the prompt once, not once per attempt', async () => {
    const { adapter } = scriptedAdapter({ 'g-1': [httpError(503), httpError(503), 'ok'] });
    const { svc, prepare } = service(adapter);
    await svc.answer({ provider: 'gemini', model: 'g-1', content: CONTENT, label: 'f' });
    expect(prepare).toHaveBeenCalledTimes(1);
  });

  it('times out a hung model call and treats it as transient', async () => {
    const adapter: AIAdapter = {
      validate: async () => undefined,
      process: vi.fn()
        .mockImplementationOnce(() => new Promise(() => undefined))
        .mockResolvedValue('after timeout'),
    };
    const { svc } = service(adapter, settings({ aiTimeoutMs: 20 }));
    await expect(svc.answer({ provider: 'gemini', model: 'g-1', content: CONTENT, label: 'f' }))
      .resolves.toMatchObject({ text: 'after timeout', attempts: 2 });
  });
});

describe('buildModelChain', () => {
  it('puts the primary first and de-duplicates fallbacks', () => {
    expect(buildModelChain('gemini', 'g-2', ['g-1', 'g-2', 'g-3'])).toEqual(['g-2', 'g-1', 'g-3']);
  });

  it('keeps OpenAI fallbacks within the same API mode', () => {
    expect(buildModelChain('openai', 'gpt-6-astra', ['gpt-5.3-codex', 'gpt-4o', 'gpt-5'])).toEqual(['gpt-6-astra', 'gpt-5.3-codex']);
    expect(buildModelChain('openai', 'gpt-4o', ['gpt-5.3-codex', 'gpt-5', 'gpt-4o-mini'])).toEqual(['gpt-4o', 'gpt-5', 'gpt-4o-mini']);
  });
});
