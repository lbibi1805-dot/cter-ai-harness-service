import { PromptContent } from './interfaces/promptContent.interface';
import { KNOWLEDGE_BLOCK_START, KNOWLEDGE_BLOCK_END } from './constants/knowledgeInjection.constants';

/**
 * Prepends knowledge.md content to the user message as a labeled reference
 * block. Empty knowledge leaves the content unchanged.
 */
export function injectKnowledge(content: PromptContent, knowledgeContent: string): PromptContent {
  if (!knowledgeContent) return content;
  const prefix = `${KNOWLEDGE_BLOCK_START}\n${knowledgeContent}\n${KNOWLEDGE_BLOCK_END}\n\n`;
  return { ...content, textContent: prefix + content.textContent };
}
