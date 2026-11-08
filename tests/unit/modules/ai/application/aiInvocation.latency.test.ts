import { describe, it, expect, vi } from 'vitest';
import { FailureKind } from '../../../../../src/shared/resilience';
import {
  AIInvocationError,
  AIInvocationService,
  AIProvider,
  AttemptOutcome,
  InvocationErrorKind,
  ModelCatalog,
  ModelRoute,
  PromptPreparer,
  type AdapterCallOptions,
  type AIAdapter,
  type AIAdapterFactory,
  type AIInvocationSettings,
  type PromptContent,
  type TextDeltaListener,
} from '../../../../../src/modules/ai';
import { buildTestAiConfig, perProvider } from '../../../../support/configFixture';

const CONTENT: PromptContent = { textContent: 'What is a mutex?', imageBuffers: [] };
const OPENROUTER_GEMINI = 'google/gemini-2.5-flash';

type Behaviour = (onDelta: TextDeltaListener | undefined, options: AdapterCallOptions) => Promise<{ text: string; model?: string }>;

const httpError = (status: number) => Object.assign(new Error(`HTTP ${status}`), { status });
const hang: Behaviour = (_d, options) => new Promise((_, reject) => options.signal?.addEventListener('abort', () => reject(options.signal?.reason)));

/** Adapter scripted per model; records every call with the options it received. */
function scripted(script: Record<string, Behaviour[]>) {
  const calls: Array<{ model: string; options: AdapterCallOptions }> = [];
  const adapter: AIAdapter = {
    validate: async () => undefined,
    process: async (_content, _system, model, onDelta, options = {}) => {
      calls.push({ model, options });
      const next = script[model]?.shift();
      if (!next) throw new Error(`no script for ${model}`);
      const result = await next(onDelta, options);
      return { text: result.text, model: result.model ?? model, usage: { inputTokens: 1000, cachedTokens: 600, outputTokens: 50 } };
    },
  };
  return { adapter, calls };
}

const ok = (text: string): Behaviour => async () => ({ text });
const fail = (status: number): Behaviour => async () => { throw httpError(status); };

function build(direct: AIAdapter | null, settings: Partial<AIInvocationSettings> = {}, openRouter: AIAdapter | null = null, now?: () => number) {
  const base = buildTestAiConfig();
  const catalog = new ModelCatalog(buildTestAiConfig({
    modelFallback: perProvider((p) => (p === AIProvider.GEMINI ? ['g-2', 'g-3'] : [])),
    openRouter: { ...base.openRouter, apiKey: openRouter ? 'or' : undefined, models: perProvider(() => OPENROUTER_GEMINI) },
  }));
  const factory: AIAdapterFactory = { direct: () => direct, openRouter: () => openRouter, credentialName: () => 'GEMINI_API_KEY' };
  const sleep = vi.fn().mockResolvedValue(undefined);
  const svc = new AIInvocationService({ maxRetryCount: 2, timeoutMs: 1_000, ...settings }, catalog, new PromptPreparer('sys', ''), factory, { sleep, ...(now ? { now } : {}) });
  return { svc, sleep };
}

const ask = (extra: object = {}) => ({ provider: AIProvider.GEMINI, model: 'g-1', content: CONTENT, label: 'q', ...extra });

function recordingStream() {
  const events: string[] = [];
  return { events, stream: { delta: (t: string) => events.push(t), reset: () => events.push('<reset>') } };
}

describe('AIInvocationService — latency guards', () => {
  it('never retries a model once text was streamed: it switches model and resets the client first', async () => {
    const { adapter, calls } = scripted({
      'g-1': [async (onDelta) => { onDelta?.('partial '); throw httpError(503); }],
      'g-2': [async (onDelta) => { onDelta?.('full answer'); return { text: 'full answer' }; }],
    });
    const { svc, sleep } = build(adapter);
    const { events, stream } = recordingStream();
    const answer = await svc.answer(ask({ stream }));
    expect(calls.map((c) => c.model)).toEqual(['g-1', 'g-2']);
    expect(events).toEqual(['partial ', '<reset>', 'full answer']);
    expect(sleep).not.toHaveBeenCalled();
    expect(answer.timings?.attempts.map((a) => [a.model, a.outcome])).toEqual([['g-1', AttemptOutcome.TRANSIENT], ['g-2', AttemptOutcome.OK]]);
  });

  it('aborts a streamed attempt that sends no first token, and moves to the next model without retrying', async () => {
    const { adapter, calls } = scripted({ 'g-1': [hang], 'g-2': [ok('fast')] });
    const { svc } = build(adapter, { latency: { firstTokenTimeoutMs: 30 } });
    const answer = await svc.answer(ask({ stream: recordingStream().stream }));
    expect(answer).toMatchObject({ text: 'fast', model: 'g-2' });
    expect(calls[0].options.signal?.aborted).toBe(true);
    expect(answer.timings?.attempts[0].outcome).toBe(AttemptOutcome.TIMEOUT);
  });

  it('drops late chunks of an aborted attempt', async () => {
    let late: TextDeltaListener | undefined;
    const { adapter } = scripted({
      'g-1': [(onDelta, options) => { late = onDelta; return hang(onDelta, options); }],
      'g-2': [async (onDelta) => { onDelta?.('answer'); return { text: 'answer' }; }],
    });
    const { svc } = build(adapter, { latency: { firstTokenTimeoutMs: 20 } });
    const { events, stream } = recordingStream();
    await svc.answer(ask({ stream }));
    late?.('stale text');
    expect(events).toEqual(['answer']);
  });

  it('respects the whole-request deadline across the direct chain and OpenRouter', async () => {
    const direct = scripted({ 'g-1': [hang], 'g-2': [hang], 'g-3': [hang] });
    const openRouter = scripted({ [OPENROUTER_GEMINI]: [hang] });
    const { svc } = build(direct.adapter, { timeoutMs: 60_000, latency: { chatDeadlineMs: 120 } }, openRouter.adapter);
    const started = Date.now();
    const err = await svc.answer(ask()).catch((e: unknown) => e);
    const elapsed = Date.now() - started;
    expect(err).toBeInstanceOf(AIInvocationError);
    expect((err as AIInvocationError).errorKind).toBe(InvocationErrorKind.DEADLINE);
    expect((err as AIInvocationError).message).toMatch(/Deadline of 120ms exceeded/);
    expect(elapsed).toBeLessThan(1_000);
    expect(direct.calls).toHaveLength(1);
    expect(openRouter.calls).toHaveLength(0);
  });

  it('a caller deadline (agent fallback) limits the call to the remaining time', async () => {
    const { adapter, calls } = scripted({ 'g-1': [hang] });
    const { svc } = build(adapter, { timeoutMs: 60_000 });
    await expect(svc.answer(ask({ deadlineAt: Date.now() + 50 }))).rejects.toMatchObject({ errorKind: InvocationErrorKind.DEADLINE });
    expect(calls[0].options.signal?.aborted).toBe(true);
  });

  it('switches away from a model that keeps answering 503 within a couple of seconds, not minutes', async () => {
    const { adapter, calls } = scripted({ 'g-1': [fail(503), fail(503), fail(503)], 'g-2': [ok('from g-2')] });
    const { svc, sleep } = build(adapter);
    const answer = await svc.answer(ask());
    expect(answer.model).toBe('g-2');
    expect(calls.map((c) => c.model)).toEqual(['g-1', 'g-1', 'g-1', 'g-2']);
    // MAX_RETRY_COUNT=2 → 2 backoffs of 1s + 2s at most.
    expect(sleep.mock.calls.reduce((sum, [ms]) => sum + (ms as number), 0)).toBeLessThanOrEqual(3_000);
  });

  it('skips a model whose circuit is open and reports it in the snapshot', async () => {
    const { adapter, calls } = scripted({
      'g-1': [fail(503), fail(503), fail(503)],
      'g-2': [ok('a'), ok('b')],
    });
    const { svc } = build(adapter);
    await svc.answer(ask());
    expect(svc.circuit.snapshot()).toEqual([expect.objectContaining({ route: ModelRoute.DIRECT, model: 'g-1', reason: 'HTTP 503' })]);
    calls.length = 0;
    const second = await svc.answer(ask());
    expect(calls.map((c) => c.model)).toEqual(['g-2']);
    expect(second.timings?.attempts[0]).toEqual({ model: 'g-1', outcome: AttemptOutcome.CIRCUIT_OPEN, ms: 0 });
  });

  it('does not retry a 4xx or a network error without status on the same model', async () => {
    const { adapter, calls } = scripted({ 'g-1': [async () => { throw new Error('socket hang up'); }], 'g-2': [fail(400)], 'g-3': [ok('ok')] });
    const { svc, sleep } = build(adapter);
    await svc.answer(ask());
    expect(calls.map((c) => c.model)).toEqual(['g-1', 'g-2', 'g-3']);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('passes the cache key and an abort signal to the adapter', async () => {
    const { adapter, calls } = scripted({ 'g-1': [ok('x')] });
    const { svc } = build(adapter);
    await svc.answer(ask({ cacheKey: 'conv-123' }));
    expect(calls[0].options.cacheKey).toBe('conv-123');
    expect(calls[0].options.signal).toBeInstanceOf(AbortSignal);
  });

  it('reports ttft, tokens and records every invocation in the latency recorder', async () => {
    let now = 1_000;
    const { adapter } = scripted({ 'g-1': [async (onDelta) => { now += 40; onDelta?.('hi'); now += 60; return { text: 'hi' }; }] });
    const { svc } = build(adapter, {}, null, () => now);
    const answer = await svc.answer(ask({ stream: recordingStream().stream }));
    expect(answer.timings).toMatchObject({ ttftMs: 40, totalMs: 100, inputTokens: 1000, cachedTokens: 600, outputTokens: 50, retrievalMs: 0 });

    const failing = scripted({ 'g-1': [fail(401)] });
    const second = build(failing.adapter, {}, null, () => now);
    await expect(second.svc.answer(ask())).rejects.toMatchObject({ kind: FailureKind.FATAL });
    expect(second.svc.metrics.entries(60_000)).toEqual([expect.objectContaining({ model: 'g-1', errorKind: FailureKind.FATAL, attempts: 1 })]);

    const summary = svc.metrics.summary(60_000);
    expect(summary.groups[0]).toMatchObject({ provider: AIProvider.GEMINI, model: 'g-1', count: 1, cacheHitRate: 0.6, ttftMs: { p50: 40, p95: 40 } });
  });
});
