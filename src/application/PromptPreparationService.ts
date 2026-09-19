import type { FileContent } from '../types';
import type { ILogger } from '../domain/ports/ILogger';
import { injectKnowledge } from '../utils/injectKnowledge';
import type { RAGRetriever } from '../rag/ragRetriever';
import type { CitationPromptBuilder } from '../rag/citationPromptBuilder';

export interface RagRefs {
  retriever?: RAGRetriever;
  builder?: CitationPromptBuilder;
}

export class PromptPreparationService {
  constructor(private logger: ILogger) {}

  async prepare(
    content: FileContent,
    systemPrompt: string,
    knowledgeContent: string,
    ragRefs?: RagRefs | (() => RagRefs),
  ): Promise<{ systemPrompt: string; fileContent: FileContent }> {
    const refs: RagRefs = typeof ragRefs === 'function' ? (ragRefs as () => RagRefs)() : ragRefs ?? {};
    if (refs.retriever && refs.builder && content.textContent.trim()) {
      try {
        const chunks = await refs.retriever.retrieve(content.textContent);
        const result = refs.builder.build(systemPrompt, chunks, content.textContent);
        return { systemPrompt: result.systemPrompt, fileContent: { ...content, textContent: result.userContent } };
      } catch (err) {
        this.logger.info(`RAG retrieval failed — falling back to knowledge.md: ${(err as Error).message}`);
      }
    }
    return { systemPrompt, fileContent: injectKnowledge(content, knowledgeContent) };
  }
}
