import type { FileContent } from '../types';

/**
 * Prepends knowledge.md content to the user message as a labeled reference block.
 * If knowledgeContent is empty, returns the original content unchanged.
 */
export function injectKnowledge(content: FileContent, knowledgeContent: string): FileContent {
  if (!knowledgeContent) return content;
  const prefix = `--- Knowledge Base ---\n${knowledgeContent}\n--- End Knowledge Base ---\n\n`;
  return {
    ...content,
    textContent: prefix + content.textContent,
  };
}
