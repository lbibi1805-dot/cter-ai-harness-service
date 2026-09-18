import type { FileContent, CitedChunk } from '../../types';
import { logger } from '../../utils/logger';
import { injectKnowledge } from '../../utils/injectKnowledge';

/**
 * Deduplicated `preparePrompt` — extracted per PLAN_MODULE_ARCHITECTURE.md mục 1 /
 * mục 4.C: `PollOrchestrator.preparePrompt` and `ConversationPoller.preparePrompt`
 * were ~85% identical (only differed in where the RAG refs came from: an instance
 * field vs. a closure-provided object). Behavior unchanged — same RAG-then-fallback
 * logic, same error handling, same knowledge.md injection fallback.
 *
 * Depends only on the minimal RAG *port* shapes it needs (not the concrete
 * `RAGRetriever`/`CitationPromptBuilder` classes), per mục 5:
 * "application/ai → modules/ai(dto/ports) + modules/rag(ports) — KHÔNG import
 * concrete RAGRetriever, chỉ port". (`CitedChunk` itself still lives in
 * `src/types.ts` pending the Phase 3 `modules/rag` dto extraction.)
 */
export interface RagRetrieverPort {
  retrieve(question: string): Promise<CitedChunk[]>;
}

export interface CitationBuilderPort {
  build(baseSystemPrompt: string, chunks: CitedChunk[], fileContent: string): { systemPrompt: string; userContent: string };
}

export interface RagRefs {
  retriever?: RagRetrieverPort;
  builder?: CitationBuilderPort;
}

export async function preparePrompt(
  content: FileContent,
  basePrompt: string,
  knowledgeContent: string,
  refs: RagRefs,
): Promise<{ systemPrompt: string; fileContent: FileContent }> {
  if (refs.retriever && refs.builder && content.textContent.trim()) {
    try {
      const chunks = await refs.retriever.retrieve(content.textContent);
      const result = refs.builder.build(basePrompt, chunks, content.textContent);
      return {
        systemPrompt: result.systemPrompt,
        fileContent: { ...content, textContent: result.userContent },
      };
    } catch (err) {
      logger.info(`RAG retrieval failed — falling back to knowledge.md: ${(err as Error).message}`);
    }
  }

  return {
    systemPrompt: basePrompt,
    fileContent: injectKnowledge(content, knowledgeContent),
  };
}
