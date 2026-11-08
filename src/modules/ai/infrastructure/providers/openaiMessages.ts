import type OpenAI from 'openai';
import { ConversationRole } from '../../domain/enums/ai.enums';
import { RenderedPartKind } from '../../domain/enums/historyRender.enums';
import { currentUserParts, renderHistory } from '../../domain/helpers/historyRender.helper';
import type { RenderedPart, RenderedTurn } from '../../domain/interfaces/historyRender.interface';
import { toDataUrl } from '../../domain/promptContent';
import { ConversationTurn, PromptContent } from '../../domain/interfaces/promptContent.interface';
import { IMAGE_DETAIL } from '../constants/openai.constants';

function toChatParts(parts: RenderedPart[]): OpenAI.ChatCompletionContentPart[] {
  return parts.map((part): OpenAI.ChatCompletionContentPart => (part.kind === RenderedPartKind.TEXT
    ? { type: 'text', text: part.text }
    : { type: 'image_url', image_url: { url: toDataUrl(part.image) } }));
}

/** User message parts in the Chat Completions format (shared by Grok, OpenAI and OpenRouter). */
export function toChatUserParts(content: PromptContent, lead: RenderedPart[] = []): OpenAI.ChatCompletionContentPart[] {
  return toChatParts(currentUserParts(content, lead));
}

export function toChatMessages(content: PromptContent, systemPrompt: string): OpenAI.ChatCompletionMessageParam[] {
  const { turns, lead } = renderHistory(content.history);
  return [
    { role: 'system', content: systemPrompt },
    ...turns.map(toChatHistoryMessage),
    { role: 'user', content: toChatUserParts(content, lead) },
  ];
}

/** Text-only turns stay plain strings (same bytes as before the hot window); a turn with images becomes parts. */
function toChatHistoryMessage(turn: RenderedTurn): OpenAI.ChatCompletionMessageParam {
  if (turn.role !== ConversationRole.USER) return { role: 'assistant', content: turn.text };
  return { role: 'user', content: turn.hasImages ? toChatParts(turn.parts) : turn.text };
}

function toResponsesParts(parts: RenderedPart[]): OpenAI.Responses.ResponseInputContent[] {
  return parts.map((part): OpenAI.Responses.ResponseInputContent => (part.kind === RenderedPartKind.TEXT
    ? { type: 'input_text', text: part.text }
    : { type: 'input_image', image_url: toDataUrl(part.image), detail: IMAGE_DETAIL }));
}

/** Earlier turns as Responses API input messages (shared by the OpenAI adapter and the agent session). */
export function toResponsesHistory(history: ConversationTurn[] = []): OpenAI.Responses.ResponseInputItem[] {
  return renderHistory(history).turns.map((turn): OpenAI.Responses.ResponseInputItem => {
    if (turn.role !== ConversationRole.USER) return { role: 'assistant', content: turn.text };
    return { role: 'user', content: turn.hasImages ? toResponsesParts(turn.parts) : turn.text };
  });
}

/** The current user message for the Responses API: last assistant turn's drawings, question, images. */
export function toResponsesUserMessage(content: PromptContent): OpenAI.Responses.ResponseInputItem {
  return { role: 'user', content: toResponsesParts(currentUserParts(content, renderHistory(content.history).lead)) };
}
