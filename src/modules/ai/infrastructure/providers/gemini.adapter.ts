import { GoogleGenAI, type Content, type GenerateContentConfig, type GenerateContentResponseUsageMetadata, type Part } from '@google/genai';
import { UpstreamError, errorMessage } from '../../../../shared/errors';
import { GEMINI_MODELS_URL } from '../../domain/constants/ai.constants';
import { ConversationRole } from '../../domain/enums/ai.enums';
import { EmptyProviderResponseError, InlineImagesTooLargeError } from '../../domain/errors/ai.errors';
import type { AdapterCallOptions, AIAdapter, ProviderReply, TextDeltaListener } from '../../domain/interfaces/aiProvider.port';
import type { ProviderTuning } from '../../domain/interfaces/latency.interface';
import { resolveProviderTuning } from '../../domain/helpers/latency.helper';
import { PromptContent, PromptImage } from '../../domain/interfaces/promptContent.interface';
import { RenderedPartKind } from '../../domain/enums/historyRender.enums';
import { allPromptImages, currentUserParts, renderHistory } from '../../domain/helpers/historyRender.helper';
import type { RenderedPart } from '../../domain/interfaces/historyRender.interface';
import { GeminiFileCache, sha256Of } from '../helpers/geminiFileCache.helper';
import type { GeminiAdapterOptions, GeminiFileRef, GeminiFilesClient } from '../interfaces/geminiFiles.interface';
import { withFinish, withUsage } from '../helpers/chatCompletionStream.helper';
import { fitThinkingLevel, geminiThinkingConfig } from '../helpers/geminiThinking.helper';
import { geminiFinishReason } from '../helpers/finishReason.helper';
import type { FinishReason } from '../../domain/enums/ai.enums';
import { geminiUsage } from '../helpers/usage.helper';
import { DEFAULT_GEMINI_INLINE_IMAGES_MAX_BYTES, GEMINI_MODEL_ROLE, GEMINI_USER_ROLE } from '../constants/gemini.constants';

/** The part of the `@google/genai` client the adapter uses (a test can hand in a fake). */
export type GeminiModelsClient = Pick<GoogleGenAI['models'], 'generateContent' | 'generateContentStream'>;

/**
 * Direct Gemini through `@google/genai`: thinking kept to GEMINI_THINKING_LEVEL (3.x models think a lot by
 * default, which is what made TTFT high), an output cap, the abort signal on every call, and no SDK retries
 * (no `retryOptions`): AIInvocationService is the only retry layer.
 */
export class GeminiAdapter implements AIAdapter {
  private readonly models: GeminiModelsClient;
  private readonly files: GeminiFilesClient | null;
  private readonly tuning: ProviderTuning;
  private readonly inlineImagesMaxBytes: number;
  private readonly fileCache: GeminiFileCache;

  constructor(
    private readonly apiKey: string,
    tuning?: Partial<ProviderTuning>,
    /** AI_TIMEOUT_MS, set as `httpOptions.timeout` on non-streamed calls (a streamed one is guarded by the caller). */
    private readonly timeoutMs?: number,
    models?: GeminiModelsClient,
    options: GeminiAdapterOptions = {},
  ) {
    const sdk = models && options.files ? null : new GoogleGenAI({ apiKey });
    this.models = models ?? sdk!.models;
    this.files = options.files ?? sdk?.files ?? null;
    this.tuning = resolveProviderTuning(tuning);
    this.inlineImagesMaxBytes = options.inlineImagesMaxBytes ?? DEFAULT_GEMINI_INLINE_IMAGES_MAX_BYTES;
    this.fileCache = new GeminiFileCache(options.now);
  }

  async validate(): Promise<void> {
    const url = new URL(GEMINI_MODELS_URL);
    url.searchParams.set('key', this.apiKey);
    url.searchParams.set('pageSize', '1');
    const res = await fetch(url);
    if (!res.ok) throw new UpstreamError(`HTTP ${res.status}`, res.status);
  }

  async process(content: PromptContent, systemPrompt: string, model: string, onDelta?: TextDeltaListener, options: AdapterCallOptions = {}): Promise<ProviderReply> {
    const maxOutputTokens = options.maxOutputTokens ?? this.tuning.maxOutputTokens;
    // Thinking shares the output cap: a level that would leave the answer < 4096 tokens is lowered (08 Bước 2).
    const thinkingLevel = fitThinkingLevel(model, options.thinkingLevel ?? this.tuning.geminiThinkingLevel, maxOutputTokens);
    const config: GenerateContentConfig = {
      systemInstruction: systemPrompt,
      maxOutputTokens,
      thinkingConfig: geminiThinkingConfig(model, thinkingLevel),
      abortSignal: options.signal,
      ...(!onDelta && this.timeoutMs ? { httpOptions: { timeout: this.timeoutMs } } : {}),
    };
    const fileRefs = await this.fileRefsFor(content, options.signal);
    const params = { model, contents: toContents(content, fileRefs), config };
    if (!onDelta) {
      const response = await this.models.generateContent(params);
      return replyOf(response.text ?? '', model, response.usageMetadata, geminiFinishReason(response.candidates?.[0]?.finishReason));
    }
    let text = '';
    let usage: GenerateContentResponseUsageMetadata | undefined;
    let finish: FinishReason | undefined;
    for await (const chunk of await this.models.generateContentStream(params)) {
      if (chunk.usageMetadata) usage = chunk.usageMetadata;
      finish = geminiFinishReason(chunk.candidates?.[0]?.finishReason) ?? finish;
      const delta = chunk.text;
      if (!delta) continue;
      text += delta;
      onDelta(delta);
    }
    return replyOf(text, model, usage, finish);
  }

  /**
   * Images already uploaded (same sha256, < 47 h) always go by `fileData`, so a hot-window image keeps the
   * same bytes in the prefix on every turn. When the rest is still over GEMINI_INLINE_IMAGES_MAX_MB, those are
   * uploaded to the Files API too; only a failed upload ends in 413 (InlineImagesTooLargeError).
   */
  private async fileRefsFor(content: PromptContent, signal: AbortSignal | undefined): Promise<Map<PromptImage, GeminiFileRef>> {
    const refs = new Map<PromptImage, GeminiFileRef>();
    const images = allPromptImages(content);
    if (images.length === 0) return refs;
    const total = images.reduce((sum, image) => sum + image.data.length, 0);
    if (this.fileCache.size === 0 && total <= this.inlineImagesMaxBytes) return refs;

    const pending: { image: PromptImage; sha: string }[] = [];
    let inlineBytes = 0;
    for (const image of images) {
      const sha = sha256Of(image.data);
      const cached = this.fileCache.get(sha);
      if (cached) refs.set(image, cached);
      else {
        pending.push({ image, sha });
        inlineBytes += image.data.length;
      }
    }
    if (inlineBytes <= this.inlineImagesMaxBytes) return refs;
    if (!this.files) throw new InlineImagesTooLargeError(inlineBytes, this.inlineImagesMaxBytes, 'no Files API client');
    try {
      const uploaded = await Promise.all(pending.map(async ({ image, sha }) => {
        const file = await this.files!.upload({
          file: new Blob([new Uint8Array(image.data)], { type: image.mimeType }),
          config: { mimeType: image.mimeType, ...(signal ? { abortSignal: signal } : {}) },
        });
        if (!file.uri) throw new Error('upload returned no uri');
        const ref = { fileUri: file.uri, mimeType: file.mimeType ?? image.mimeType };
        this.fileCache.set(sha, ref);
        return { image, ref };
      }));
      for (const { image, ref } of uploaded) refs.set(image, ref);
    } catch (err) {
      throw new InlineImagesTooLargeError(inlineBytes, this.inlineImagesMaxBytes, errorMessage(err));
    }
    return refs;
  }
}

function toPart(part: RenderedPart, fileRefs: Map<PromptImage, GeminiFileRef>): Part {
  if (part.kind === RenderedPartKind.TEXT) return { text: part.text };
  const ref = fileRefs.get(part.image);
  return ref
    ? { fileData: { fileUri: ref.fileUri, mimeType: ref.mimeType } }
    : { inlineData: { mimeType: part.image.mimeType, data: part.image.data.toString('base64') } };
}

/** Same layout as every adapter (`renderHistory`): history images in place, last drawings lead the question. */
function toContents(content: PromptContent, fileRefs: Map<PromptImage, GeminiFileRef> = new Map()): Content[] {
  const { turns, lead } = renderHistory(content.history);
  const history: Content[] = turns.map((turn) => ({
    role: turn.role === ConversationRole.USER ? GEMINI_USER_ROLE : GEMINI_MODEL_ROLE,
    parts: turn.hasImages ? turn.parts.map((part) => toPart(part, fileRefs)) : [{ text: turn.text }],
  }));
  return [...history, { role: GEMINI_USER_ROLE, parts: currentUserParts(content, lead).map((part) => toPart(part, fileRefs)) }];
}

/** An empty answer (safety block, output cap hit while thinking) is an error so the next model gets a turn. */
function replyOf(text: string, model: string, usage: GenerateContentResponseUsageMetadata | undefined, finish?: FinishReason): ProviderReply {
  if (!text) throw new EmptyProviderResponseError(`Gemini ${model} returned no text`);
  return withFinish(withUsage({ text, model }, geminiUsage(usage)), finish);
}
