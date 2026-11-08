import {
  CONVERSATION_MEMORY_ANCHOR,
  CONVERSATION_SOURCE_RULE,
  DIAGRAM_EDIT_RULE,
  SUMMARY_TURN_ACK,
  SUMMARY_TURN_HEADER,
} from '../constants/promptLayers.constants';
import { ConversationRole } from '../enums/ai.enums';
import { PromptCacheLayout } from '../enums/promptLayout.enums';
import type { ConversationTurn, PromptContent } from '../interfaces/promptContent.interface';

/** Appends conversation memory (summary + artifact registry) after the static system prompt (layout V1). */
export function withMemory(systemPrompt: string, memory: string | undefined): string {
  return memory?.trim() ? `${systemPrompt}\n\n${memory.trim()}` : systemPrompt;
}

/** Puts just-in-time artifacts in front of the user content (before RAG context and question). */
export function withJit(userContent: string, jit: string | undefined): string {
  return jit?.trim() ? `${jit.trim()}\n\n${userContent}` : userContent;
}

/** Static conversation rules (source rule + memory anchor + diagram-edit rule) appended to a system prompt (layout V2). */
export function withConversationRules(systemPrompt: string): string {
  return `${systemPrompt}\n\n${CONVERSATION_SOURCE_RULE}\n${CONVERSATION_MEMORY_ANCHOR}\n${DIAGRAM_EDIT_RULE}`;
}

/** Layer ① of layout V2: base + citation rules + conversation rules — the same bytes for every request. */
export function composeStaticSystemPrompt(basePrompt: string, citationRules: string): string {
  return withConversationRules(`${basePrompt}\n\n${citationRules}`);
}

/** Layer ② of layout V2: the summary as the first (user) history turn plus a static assistant ack. */
export function summaryTurns(summary: string | undefined): ConversationTurn[] {
  if (!summary?.trim()) return [];
  return [
    { role: ConversationRole.USER, text: `${SUMMARY_TURN_HEADER}\n${summary.trim()}` },
    { role: ConversationRole.ASSISTANT, text: SUMMARY_TURN_ACK },
  ];
}

/**
 * Places the conversation memory layers into the content for the chosen layout
 * (producer side, used by the context module):
 * - V1: `memory` = summary + registry (the consumer appends it to the system prompt);
 * - V2: summary → first history turns, registry → in front of the JIT artifacts (tail).
 */
export function layoutConversationMemory(
  content: PromptContent,
  layers: { summary?: string; registry?: string; memoryV1?: string },
  layout: PromptCacheLayout,
): PromptContent {
  if (layout === PromptCacheLayout.V1) return { ...content, memory: layers.memoryV1 || undefined };
  const tail = [layers.registry, content.jitContext].filter((s) => s?.trim()).join('\n\n');
  return {
    ...content,
    history: [...summaryTurns(layers.summary), ...(content.history ?? [])],
    memory: undefined,
    jitContext: tail || undefined,
  };
}

/**
 * Consumer side (single-shot preparer, agent answerer): returns the system prompt and the
 * user text with the memory/JIT layers placed for the layout. V2 never touches the system
 * prompt: any `memory` still set goes to the tail with the JIT artifacts.
 */
export function placeMemory(systemPrompt: string, content: PromptContent, layout: PromptCacheLayout): { systemPrompt: string; textContent: string } {
  if (layout === PromptCacheLayout.V1) {
    return { systemPrompt: withMemory(systemPrompt, content.memory), textContent: withJit(content.textContent, content.jitContext) };
  }
  const tail = [content.memory, content.jitContext].filter((s) => s?.trim()).map((s) => s!.trim()).join('\n\n');
  return { systemPrompt, textContent: withJit(content.textContent, tail) };
}
