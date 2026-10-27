import type OpenAI from 'openai';
import { EmptyProviderResponseError } from '../../domain/errors/ai.errors';
import type { ProviderReply, TextDeltaListener } from '../../domain/interfaces/aiProvider.port';
import type { OpenRouterErrorBody } from '../interfaces/openRouter.interface';

/**
 * Streams a Chat Completions request (OpenAI, xAI and OpenRouter speak the same protocol), reporting each text
 * chunk. OpenRouter may put an error inside a chunk instead of failing the HTTP call; that becomes an exception
 * carrying the upstream code so the failure classifier can retry, fall back or stop.
 */
export async function streamChatCompletion(
  client: OpenAI,
  body: OpenAI.ChatCompletionCreateParamsStreaming,
  onDelta: TextDeltaListener,
): Promise<ProviderReply> {
  const stream = await client.chat.completions.create(body);
  let text = '';
  let model = body.model;
  for await (const chunk of stream) {
    const bodyError = (chunk as unknown as OpenRouterErrorBody).error;
    if (bodyError) {
      throw new EmptyProviderResponseError(`${body.model}: ${bodyError.code ?? ''} ${bodyError.message ?? 'stream error'}`.trim(), bodyError.code);
    }
    if (chunk.model) model = chunk.model;
    const delta = chunk.choices?.[0]?.delta?.content;
    if (!delta) continue;
    text += delta;
    onDelta(delta);
  }
  if (!text) throw new EmptyProviderResponseError(`${body.model} streamed no text`);
  return { text, model };
}
