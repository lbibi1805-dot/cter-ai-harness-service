import { describe, expect, it, vi } from 'vitest';
import type OpenAI from 'openai';
import type Anthropic from '@anthropic-ai/sdk';
import { ConversationRole, InlineImagesTooLargeError, normalizeHistory, renderHistory, toChatMessages, toResponsesHistory, type PromptContent } from '../../../../../src/modules/ai';
import { GeminiAdapter, type GeminiModelsClient } from '../../../../../src/modules/ai/infrastructure/providers/gemini.adapter';
import { OpenAIAdapter } from '../../../../../src/modules/ai/infrastructure/providers/openai.adapter';
import { ClaudeAdapter } from '../../../../../src/modules/ai/infrastructure/providers/claude.adapter';
import type { GeminiFilesClient } from '../../../../../src/modules/ai/infrastructure/interfaces/geminiFiles.interface';

const USER_IMG = { data: Buffer.from('user-png'), mimeType: 'image/png', alias: 'A1' };
const C4_IMG = { data: Buffer.from('c4-png'), mimeType: 'image/png', alias: 'A3' };
const CURRENT = { data: Buffer.from('now-jpg'), mimeType: 'image/jpeg' };
const MARKER = '[Hình [A3] do trợ lý vẽ ở lượt trước]';

/** Window of 2 pairs: user image in turn 1, a C4 PNG drawn by the assistant in turn 2 (the last history turn). */
const WINDOWED: PromptContent = {
  textContent: 'Q?',
  imageBuffers: [CURRENT],
  history: [
    { role: ConversationRole.USER, text: 'old question' },
    { role: ConversationRole.ASSISTANT, text: 'old answer' },
    { role: ConversationRole.USER, text: 'đề đây', images: [USER_IMG] },
    { role: ConversationRole.ASSISTANT, text: 'đã đọc' },
    { role: ConversationRole.USER, text: '/c4 vẽ' },
    { role: ConversationRole.ASSISTANT, text: 'đã vẽ', images: [C4_IMG] },
  ],
};

describe('renderHistory (one layout for every provider)', () => {
  it('user images stay on their turn; an assistant drawing leads the next user message with a marker', () => {
    const { turns, lead } = renderHistory(WINDOWED.history);
    expect(turns.map((t) => t.hasImages)).toEqual([false, false, true, false, false, false]);
    expect(turns[2].parts.map((p) => p.kind)).toEqual(['text', 'image']);
    expect(lead.map((p) => (p.kind === 'text' ? p.text : p.image.alias))).toEqual([MARKER, 'A3']);
  });

  it('an assistant drawing in the middle of history opens the following user turn', () => {
    const { turns, lead } = renderHistory([
      { role: ConversationRole.USER, text: 'vẽ' },
      { role: ConversationRole.ASSISTANT, text: 'xong', images: [C4_IMG] },
      { role: ConversationRole.USER, text: 'giải thích' },
      { role: ConversationRole.ASSISTANT, text: 'ok' },
    ]);
    expect(lead).toEqual([]);
    expect(turns[2].parts.map((p) => (p.kind === 'text' ? p.text : 'IMG'))).toEqual([MARKER, 'IMG', 'giải thích']);
  });

  it('normalizeHistory keeps images and concatenates them when turns merge', () => {
    const merged = normalizeHistory([
      { role: ConversationRole.USER, text: 'a', images: [USER_IMG] },
      { role: ConversationRole.USER, text: 'b', images: [CURRENT] },
      { role: ConversationRole.ASSISTANT, text: 'c' },
    ]);
    expect(merged).toEqual([{ role: 'user', text: 'a\n\nb', images: [USER_IMG, CURRENT] }, { role: 'assistant', text: 'c' }]);
    expect(normalizeHistory([{ role: ConversationRole.USER, text: 'x' }, { role: ConversationRole.ASSISTANT, text: 'y' }])[0]).not.toHaveProperty('images');
  });

  it('text-only history renders byte-identical to the pre-window format (chat + responses)', () => {
    const plain = { textContent: 'Q', imageBuffers: [], history: [{ role: ConversationRole.USER, text: 'hi' }, { role: ConversationRole.ASSISTANT, text: 'yo' }] };
    expect(toChatMessages(plain, 'S').slice(1, 3)).toEqual([{ role: 'user', content: 'hi' }, { role: 'assistant', content: 'yo' }]);
    expect(toResponsesHistory(plain.history)).toEqual([{ role: 'user', content: 'hi' }, { role: 'assistant', content: 'yo' }]);
  });
});

describe('adapters send hot-window images in place', () => {
  it('OpenAI chat completions (also Grok/OpenRouter/agent): image parts on the user turn, drawing leads the question', async () => {
    const create = vi.fn(async () => ({ choices: [{ message: { content: 'ok' } }] }));
    const client = { chat: { completions: { create } }, responses: { create: vi.fn() } } as unknown as OpenAI;
    await new OpenAIAdapter('k', {}, client).process(WINDOWED, 'sys', 'gpt-4o');
    const [body] = create.mock.calls[0] as unknown as [{ messages: OpenAI.ChatCompletionMessageParam[] }];
    expect(body.messages[1]).toEqual({ role: 'user', content: 'old question' });
    expect(body.messages[3]).toEqual({ role: 'user', content: [{ type: 'text', text: 'đề đây' }, { type: 'image_url', image_url: { url: `data:image/png;base64,${USER_IMG.data.toString('base64')}` } }] });
    expect(body.messages[6]).toEqual({ role: 'assistant', content: 'đã vẽ' });
    const last = body.messages[7] as { content: { type: string; text?: string }[] };
    expect(last.content.map((p) => p.type)).toEqual(['text', 'image_url', 'text', 'image_url']);
    expect(last.content[0].text).toBe(MARKER);
    expect(last.content[2].text).toBe('Q?');
  });

  it('OpenAI responses: input_image parts in history and in the current message', async () => {
    const create = vi.fn(async () => ({ output_text: 'ok' }));
    const client = { chat: { completions: { create: vi.fn() } }, responses: { create } } as unknown as OpenAI;
    await new OpenAIAdapter('k', {}, client).process(WINDOWED, 'sys', 'gpt-6-astra');
    const [body] = create.mock.calls[0] as unknown as [{ input: { role: string; content: unknown }[] }];
    expect(body.input[3]).toMatchObject({ role: 'user', content: [{ type: 'input_text', text: 'đề đây' }, { type: 'input_image' }] });
    expect((body.input[7].content as { type: string }[]).map((p) => p.type)).toEqual(['input_text', 'input_image', 'input_text', 'input_image']);
  });

  it('Claude: base64 image blocks; the cache breakpoint lands on the last block of the last history turn', async () => {
    const create = vi.fn(async () => ({ content: [{ type: 'text', text: 'ok' }], usage: { input_tokens: 1, output_tokens: 1 } }));
    const client = { messages: { create } } as unknown as Anthropic;
    const content: PromptContent = { ...WINDOWED, history: WINDOWED.history!.slice(0, 4) };
    await new ClaudeAdapter('k', { claudePromptCache: true }, client).process(content, 'sys', 'claude-sonnet-4-6');
    const [params] = create.mock.calls[0] as unknown as [{ messages: { role: string; content: unknown }[] }];
    expect(params.messages[2]).toMatchObject({ role: 'user', content: [{ type: 'text', text: 'đề đây' }, { type: 'image', source: { type: 'base64', media_type: 'image/png' } }] });
    expect(params.messages[3]).toEqual({ role: 'assistant', content: [{ type: 'text', text: 'đã đọc', cache_control: { type: 'ephemeral' } }] });
    const current = params.messages[4].content as { type: string }[];
    expect(current.map((b) => b.type)).toEqual(['text', 'image']);
  });
});

describe('GeminiAdapter: inline images and the Files API', () => {
  function fakes(upload?: GeminiFilesClient['upload']) {
    const generateContent = vi.fn(async () => ({ text: 'ok', usageMetadata: {} }));
    let n = 0;
    const uploadFn = vi.fn(upload ?? (async () => ({ uri: `https://files/${++n}`, mimeType: 'image/png' })));
    return {
      generateContent,
      upload: uploadFn,
      models: { generateContent, generateContentStream: vi.fn() } as unknown as GeminiModelsClient,
      files: { upload: uploadFn } as unknown as GeminiFilesClient,
    };
  }
  type Contents = { role: string; parts: Record<string, unknown>[] }[];
  const contentsOf = (f: ReturnType<typeof fakes>, call = 0) => (f.generateContent.mock.calls[call] as unknown as [{ contents: Contents }])[0].contents;

  it('under the limit: history images inline, in place; the drawing + marker lead the question', async () => {
    const f = fakes();
    await new GeminiAdapter('k', {}, 5_000, f.models, { files: f.files }).process(WINDOWED, 'sys', 'gemini-3.5-flash');
    const contents = contentsOf(f);
    expect(contents[0]).toEqual({ role: 'user', parts: [{ text: 'old question' }] });
    expect(contents[2].parts).toEqual([{ text: 'đề đây' }, { inlineData: { mimeType: 'image/png', data: USER_IMG.data.toString('base64') } }]);
    expect(contents[5]).toEqual({ role: 'model', parts: [{ text: 'đã vẽ' }] });
    expect(contents[6].parts.map((p) => Object.keys(p)[0])).toEqual(['text', 'inlineData', 'text', 'inlineData']);
    expect(contents[6].parts[0]).toEqual({ text: MARKER });
    expect(f.upload).not.toHaveBeenCalled();
  });

  it('over GEMINI_INLINE_IMAGES_MAX_MB: uploads to the Files API once, then reuses the URI (stable prefix)', async () => {
    const f = fakes();
    const adapter = new GeminiAdapter('k', {}, 5_000, f.models, { files: f.files, inlineImagesMaxBytes: 10 });
    await adapter.process(WINDOWED, 'sys', 'gemini-3.5-flash');
    expect(f.upload).toHaveBeenCalledTimes(3);
    const first = contentsOf(f, 0);
    expect(first[2].parts[1]).toEqual({ fileData: { fileUri: expect.stringMatching(/^https:\/\/files\//), mimeType: 'image/png' } });

    // Next turn: same history images (same bytes) + a new tiny current image → nothing re-uploaded for the window.
    const next: PromptContent = { ...WINDOWED, imageBuffers: [] };
    await adapter.process(next, 'sys', 'gemini-3.5-flash');
    expect(f.upload).toHaveBeenCalledTimes(3);
    expect(contentsOf(f, 1)[2].parts[1]).toEqual(first[2].parts[1]);
  });

  it('413 (InlineImagesTooLargeError) only when the Files API upload fails', async () => {
    const f = fakes(async () => { throw new Error('quota'); });
    const adapter = new GeminiAdapter('k', {}, 5_000, f.models, { files: f.files, inlineImagesMaxBytes: 10 });
    const error = await adapter.process(WINDOWED, 'sys', 'gemini-3.5-flash').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(InlineImagesTooLargeError);
    expect((error as InlineImagesTooLargeError).status).toBe(413);
    expect(f.generateContent).not.toHaveBeenCalled();
  });
});
