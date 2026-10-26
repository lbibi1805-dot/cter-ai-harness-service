import type OpenAI from 'openai';
import { toDataUrl } from '../../domain/promptContent';
import { PromptContent } from '../../domain/interfaces/promptContent.interface';

/** User message parts in the Chat Completions format (shared by Grok, OpenAI and OpenRouter). */
export function toChatUserParts(content: PromptContent): OpenAI.ChatCompletionContentPart[] {
  const parts: OpenAI.ChatCompletionContentPart[] = [];
  if (content.textContent) parts.push({ type: 'text', text: content.textContent });
  for (const image of content.imageBuffers) parts.push({ type: 'image_url', image_url: { url: toDataUrl(image) } });
  return parts;
}

export function toChatMessages(content: PromptContent, systemPrompt: string): OpenAI.ChatCompletionMessageParam[] {
  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: toChatUserParts(content) },
  ];
}
