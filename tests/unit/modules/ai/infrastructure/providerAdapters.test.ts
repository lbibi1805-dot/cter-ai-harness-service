import { describe, expect, it, vi } from 'vitest';
import type OpenAI from 'openai';
import type Anthropic from '@anthropic-ai/sdk';
import { ThinkingLevel } from '@google/genai';
import { ConversationRole, GeminiThinkingLevel, OpenAIServiceTier, PromptCacheKeyMode, type PromptContent } from '../../../../../src/modules/ai';
import { GeminiAdapter, type GeminiModelsClient } from '../../../../../src/modules/ai/infrastructure/providers/gemini.adapter';
import { OpenAIAdapter } from '../../../../../src/modules/ai/infrastructure/providers/openai.adapter';
import { ClaudeAdapter } from '../../../../../src/modules/ai/infrastructure/providers/claude.adapter';
import { geminiThinkingConfig } from '../../../../../src/modules/ai/infrastructure/helpers/geminiThinking.helper';
import { promptCacheKey } from '../../../../../src/modules/ai/infrastructure/helpers/openaiTuning.helper';

const CONTENT: PromptContent = {
  textContent: 'Q?',
  imageBuffers: [],
  history: [{ role: ConversationRole.USER, text: 'hi' }, { role: ConversationRole.ASSISTANT, text: 'hello' }],
};

async function* iterate<T>(items: T[]): AsyncGenerator<T> {
  for (const item of items) yield item;
}

describe('GeminiAdapter (@google/genai)', () => {
  function fakeModels() {
    const generateContent = vi.fn(async () => ({ text: 'answer', usageMetadata: { promptTokenCount: 900, candidatesTokenCount: 40, thoughtsTokenCount: 5, cachedContentTokenCount: 512 } }));
    const generateContentStream = vi.fn(async () => iterate([
      { text: 'ans' },
      { text: 'wer', usageMetadata: { promptTokenCount: 900, candidatesTokenCount: 40, cachedContentTokenCount: 0 } },
    ]));
    return { generateContent, generateContentStream, models: { generateContent, generateContentStream } as unknown as GeminiModelsClient };
  }

  it('sends thinking level, output cap, timeout and abort signal, and parses cached tokens', async () => {
    const fake = fakeModels();
    const adapter = new GeminiAdapter('k', { maxOutputTokens: 777 }, 5_000, fake.models);
    const signal = new AbortController().signal;
    const reply = await adapter.process(CONTENT, 'sys', 'gemini-3.1-flash-lite', undefined, { signal });
    expect(reply).toEqual({ text: 'answer', model: 'gemini-3.1-flash-lite', usage: { inputTokens: 900, outputTokens: 45, cachedTokens: 512 } });
    const params = fake.generateContent.mock.calls[0] as unknown as [{ contents: unknown[]; config: Record<string, unknown> }];
    expect(params[0].config).toMatchObject({
      systemInstruction: 'sys',
      maxOutputTokens: 777,
      thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
      abortSignal: signal,
      httpOptions: { timeout: 5_000 },
    });
    expect(params[0].contents).toHaveLength(3);
  });

  it('streams text deltas and keeps the usage of the last chunk', async () => {
    const fake = fakeModels();
    const deltas: string[] = [];
    const reply = await new GeminiAdapter('k', {}, 5_000, fake.models).process(CONTENT, 'sys', 'gemini-2.5-flash-lite', (t) => deltas.push(t));
    expect(deltas).toEqual(['ans', 'wer']);
    expect(reply).toEqual({ text: 'answer', model: 'gemini-2.5-flash-lite', usage: { inputTokens: 900, outputTokens: 40, cachedTokens: 0 } });
    const params = fake.generateContentStream.mock.calls[0] as unknown as [{ config: Record<string, unknown> }];
    expect(params[0].config.thinkingConfig).toEqual({ thinkingBudget: 0 });
    expect(params[0].config.httpOptions).toBeUndefined();
  });

  it('maps the thinking level per model family', () => {
    expect(geminiThinkingConfig('gemini-3.5-flash', GeminiThinkingLevel.MINIMAL)).toEqual({ thinkingLevel: ThinkingLevel.MINIMAL });
    expect(geminiThinkingConfig('gemini-3.1-pro-preview', GeminiThinkingLevel.MINIMAL)).toEqual({ thinkingLevel: ThinkingLevel.LOW });
    expect(geminiThinkingConfig('gemini-2.5-flash', GeminiThinkingLevel.MINIMAL)).toEqual({ thinkingBudget: 0 });
    expect(geminiThinkingConfig('gemini-2.5-pro', GeminiThinkingLevel.MINIMAL)).toEqual({ thinkingBudget: 128 });
  });

  it('treats an empty answer as an error so the next model gets a turn', async () => {
    const generateContent = vi.fn(async () => ({ text: undefined }));
    const adapter = new GeminiAdapter('k', {}, 5_000, { generateContent } as unknown as GeminiModelsClient);
    await expect(adapter.process(CONTENT, 'sys', 'gemini-3.5-flash')).rejects.toThrow(/returned no text/);
  });
});

describe('OpenAIAdapter', () => {
  function fakeClient() {
    const chatCreate = vi.fn(async (body: { stream?: boolean }) => (body.stream
      ? iterate([
        { model: 'gpt-5', choices: [{ delta: { content: 'he' } }] },
        { model: 'gpt-5', choices: [{ delta: { content: 'llo' } }] },
        { model: 'gpt-5', choices: [], usage: { prompt_tokens: 2000, completion_tokens: 9, prompt_tokens_details: { cached_tokens: 1536 } } },
      ])
      : { choices: [{ message: { content: 'hello' } }], usage: { prompt_tokens: 2000, completion_tokens: 9, prompt_tokens_details: { cached_tokens: 1024 } } }));
    const responsesCreate = vi.fn(async (body: { stream?: boolean }) => (body.stream
      ? iterate([
        { type: 'response.output_text.delta', delta: 'hi' },
        { type: 'response.completed', response: { usage: { input_tokens: 3000, output_tokens: 7, input_tokens_details: { cached_tokens: 2048 } } } },
      ])
      : { output_text: 'hi', usage: { input_tokens: 3000, output_tokens: 7, input_tokens_details: { cached_tokens: 0 } } }));
    const client = { chat: { completions: { create: chatCreate } }, responses: { create: responsesCreate } } as unknown as OpenAI;
    return { client, chatCreate, responsesCreate };
  }

  it('chat: reasoning effort for reasoning models, output cap, service tier, prompt cache key, signal and cached tokens', async () => {
    const fake = fakeClient();
    const adapter = new OpenAIAdapter('k', { openaiServiceTier: OpenAIServiceTier.PRIORITY }, fake.client);
    const signal = new AbortController().signal;
    const reply = await adapter.process(CONTENT, 'sys', 'gpt-5', undefined, { signal, cacheKey: 'abc' });
    expect(reply.usage).toEqual({ inputTokens: 2000, outputTokens: 9, cachedTokens: 1024 });
    const [body, options] = fake.chatCreate.mock.calls[0] as unknown as [Record<string, unknown>, { signal: AbortSignal }];
    expect(body).toMatchObject({ model: 'gpt-5', reasoning_effort: 'low', max_completion_tokens: 8192, service_tier: 'priority', prompt_cache_key: 'conv-abc' });
    expect(options.signal).toBe(signal);
  });

  it('chat: no reasoning effort for gpt-4o; streamed usage comes from the final chunk', async () => {
    const fake = fakeClient();
    const deltas: string[] = [];
    const reply = await new OpenAIAdapter('k', {}, fake.client).process(CONTENT, 'sys', 'gpt-4o', (t) => deltas.push(t));
    expect(deltas).toEqual(['he', 'llo']);
    expect(reply.usage).toEqual({ inputTokens: 2000, outputTokens: 9, cachedTokens: 1536 });
    const [body] = fake.chatCreate.mock.calls[0] as unknown as [Record<string, unknown>];
    expect(body.reasoning_effort).toBeUndefined();
    expect(body.stream_options).toEqual({ include_usage: true });
  });

  it('responses: reasoning.effort, max_output_tokens and cached tokens (streamed and not)', async () => {
    const fake = fakeClient();
    const adapter = new OpenAIAdapter('k', { openaiPromptCacheKey: PromptCacheKeyMode.OFF }, fake.client);
    const plain = await adapter.process(CONTENT, 'sys', 'gpt-6-astra');
    expect(plain).toEqual({ text: 'hi', model: 'gpt-6-astra', usage: { inputTokens: 3000, outputTokens: 7, cachedTokens: 0 } });
    const streamed = await adapter.process(CONTENT, 'sys', 'gpt-6-astra', () => undefined);
    expect(streamed.usage).toEqual({ inputTokens: 3000, outputTokens: 7, cachedTokens: 2048 });
    const [body] = fake.responsesCreate.mock.calls[0] as unknown as [Record<string, unknown>];
    expect(body).toMatchObject({ reasoning: { effort: 'low' }, max_output_tokens: 8192 });
    expect(body.prompt_cache_key).toBeUndefined();
  });

  it('derives the prompt cache key from the mode', () => {
    expect(promptCacheKey(PromptCacheKeyMode.CONVERSATION, 'c1', 'sys')).toBe('conv-c1');
    const version = promptCacheKey(PromptCacheKeyMode.PROMPT_VERSION, 'c1', 'sys');
    expect(version).toMatch(/^pv-[0-9a-f]{16}$/);
    expect(promptCacheKey(PromptCacheKeyMode.CONVERSATION, undefined, 'sys')).toBe(version);
    expect(promptCacheKey(PromptCacheKeyMode.OFF, 'c1', 'sys')).toBeUndefined();
  });
});

describe('ClaudeAdapter', () => {
  const usage = { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 3000, cache_creation_input_tokens: 500 };
  function fakeClient() {
    const create = vi.fn(async () => ({ content: [{ type: 'text', text: 'claude says' }], usage }));
    const client = { messages: { create } } as unknown as Anthropic;
    return { client, create };
  }

  it('parses cache reads and sends no cache_control by default', async () => {
    const fake = fakeClient();
    const reply = await new ClaudeAdapter('k', {}, fake.client).process(CONTENT, 'sys', 'claude-sonnet-4-6');
    expect(reply.usage).toEqual({ inputTokens: 3600, outputTokens: 20, cachedTokens: 3000 });
    const [params] = fake.create.mock.calls[0] as unknown as [{ system: unknown; messages: Array<{ content: unknown }> }];
    expect(params.system).toBe('sys');
    expect(params.messages[1].content).toBe('hello');
  });

  it('puts cache_control on the system prompt and the last history turn when PROMPT_CACHE_CLAUDE=true', async () => {
    const fake = fakeClient();
    await new ClaudeAdapter('k', { claudePromptCache: true }, fake.client).process(CONTENT, 'sys', 'claude-sonnet-4-6');
    const [params] = fake.create.mock.calls[0] as unknown as [{ system: unknown; messages: Array<{ content: unknown }> }];
    expect(params.system).toEqual([{ type: 'text', text: 'sys', cache_control: { type: 'ephemeral' } }]);
    expect(params.messages[0].content).toBe('hi');
    expect(params.messages[1].content).toEqual([{ type: 'text', text: 'hello', cache_control: { type: 'ephemeral' } }]);
  });
});
