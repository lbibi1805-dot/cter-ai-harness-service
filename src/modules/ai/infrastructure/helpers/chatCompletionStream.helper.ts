import type OpenAI from 'openai';
import { EmptyProviderResponseError } from '../../domain/errors/ai.errors';
import type { ProviderReply, ProviderUsage, TextDeltaListener } from '../../domain/interfaces/aiProvider.port';
import type { OpenRouterErrorBody } from '../interfaces/openRouter.interface';
import { chatCompletionUsage } from './usage.helper';

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
  for await (const chunk of stream) {
    const bodyError = (chunk as unknown as OpenRouterErrorBody).error;
    if (bodyError) {
      throw new EmptyProviderResponseError(`${body.model}: ${bodyError.code ?? ''} ${bodyError.message ?? 'stream error'}`.trim(), bodyError.code);
    }
    if (chunk.model) model = chunk.model;
    if (chunk.usage) usage = chatCompletionUsage(chunk.usage);
    const delta = chunk.choices?.[0]?.delta?.content;
    if (!delta) continue;
    text += delta;
    onDelta(delta);
  }
  if (!text) throw new EmptyProviderResponseError(`${body.model} streamed no text`);
  return withUsage({ text, model }, usage);
}

/** Adds `usage` only when the provider reported it. */
export function withUsage(reply: ProviderReply, usage: ProviderUsage | undefined): ProviderReply {
  return usage ? { ...reply, usage } : reply;
}
