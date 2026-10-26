import type OpenAI from 'openai';
import { ConversationRole } from '../../domain/enums/ai.enums';
import { toDataUrl } from '../../domain/promptContent';
import { ConversationTurn, PromptContent } from '../../domain/interfaces/promptContent.interface';

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
    ...(content.history ?? []).map(toChatHistoryMessage),
    { role: 'user', content: toChatUserParts(content) },
  ];
}

function toChatHistoryMessage(turn: ConversationTurn): OpenAI.ChatCompletionMessageParam {
  return turn.role === ConversationRole.USER ? { role: 'user', content: turn.text } : { role: 'assistant', content: turn.text };
}

/** Earlier turns as Responses API input messages (shared by the OpenAI adapter and the agent session). */
export function toResponsesHistory(history: ConversationTurn[] = []): OpenAI.Responses.ResponseInputItem[] {
  return history.map((turn) => ({ role: turn.role === ConversationRole.USER ? 'user' : 'assistant', content: turn.text }));
}
