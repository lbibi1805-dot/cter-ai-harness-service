import type OpenAI from 'openai';
import { EmptyProviderResponseError } from '../../domain/errors/ai.errors';
import type { FinishReason } from '../../domain/enums/ai.enums';
import type { ProviderReply, ProviderUsage, TextDeltaListener } from '../../domain/interfaces/aiProvider.port';
import type { OpenRouterErrorBody } from '../interfaces/openRouter.interface';
import { chatCompletionUsage } from './usage.helper';
import { chatFinishReason } from './finishReason.helper';

/**
 * Streams a Chat Completions request (OpenAI, xAI and OpenRouter speak the same protocol), reporting each text
 * chunk. OpenRouter may put an error inside a chunk instead of failing the HTTP call; that becomes an exception
 * carrying the upstream code so the failure classifier can retry, fall back or stop. Usage arrives in the last
 * chunk (`stream_options.include_usage`).
 */
export async function streamChatCompletion(
  client: OpenAI,
  body: OpenAI.ChatCompletionCreateParamsStreaming,
  onDelta: TextDeltaListener,
  signal?: AbortSignal,
): Promise<ProviderReply> {
  const stream = await client.chat.completions.create({ ...body, stream_options: { include_usage: true } }, { signal });
  let text = '';
  let model = body.model;
  let usage: ProviderUsage | undefined;
  let finish: FinishReason | undefined;
  for await (const chunk of stream) {
    const bodyError = (chunk as unknown as OpenRouterErrorBody).error;
    if (bodyError) {
      throw new EmptyProviderResponseError(`${body.model}: ${bodyError.code ?? ''} ${bodyError.message ?? 'stream error'}`.trim(), bodyError.code);
    }
    if (chunk.model) model = chunk.model;
    if (chunk.usage) usage = chatCompletionUsage(chunk.usage);
    finish = chatFinishReason(chunk.choices?.[0]?.finish_reason) ?? finish;
    const delta = chunk.choices?.[0]?.delta?.content;
    if (!delta) continue;
    text += delta;
    onDelta(delta);
  }
  if (!text) throw new EmptyProviderResponseError(`${body.model} streamed no text`);
  return withFinish(withUsage({ text, model }, usage), finish);
}

/** Adds `finishReason` only when the provider reported one (08 Bước 2). */
export function withFinish(reply: ProviderReply, finishReason: FinishReason | undefined): ProviderReply {
  return finishReason ? { ...reply, finishReason } : reply;
}

/** Adds `usage` only when the provider reported it. */
export function withUsage(reply: ProviderReply, usage: ProviderUsage | undefined): ProviderReply {
  return usage ? { ...reply, usage } : reply;
}
