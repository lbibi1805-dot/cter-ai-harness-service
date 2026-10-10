import { CitationPromptBuilder } from '../../../rag/citationPromptBuilder';
import type { ChunkRetriever } from '../../rerank/domain/reranker.port';
import type { FileContent } from '../../../types';
import { injectKnowledge } from '../../../utils/injectKnowledge';
import { logger } from '../../../utils/logger';

export interface RagRefs {
  retriever?: ChunkRetriever;
  builder?: CitationPromptBuilder;
}

/**
 * Read on every call, never snapshotted: RAG becomes available asynchronously
 * after the vault finishes indexing at startup.
 */
export type RagRefsProvider = () => RagRefs;

export interface PreparedPrompt {
  systemPrompt: string;
  content: FileContent;
}

/** Builds the final prompt: RAG context when available, otherwise knowledge.md. */
export class PromptPreparer {
  constructor(
    private readonly systemPrompt: string,
    private readonly knowledgeContent: string,
    private readonly rag: RagRefsProvider = () => ({}),
  ) {}

  async prepare(content: FileContent): Promise<PreparedPrompt> {
    const { retriever, builder } = this.rag();
    if (retriever && builder && content.textContent.trim()) {
      try {
        const chunks = await retriever.retrieve(content.textContent);
        const result = builder.build(this.systemPrompt, chunks, content.textContent);
        return { systemPrompt: result.systemPrompt, content: { ...content, textContent: result.userContent } };
      } catch (err) {
        logger.info(`RAG retrieval failed — falling back to knowledge.md: ${(err as Error).message}`);
      }
    }
    return { systemPrompt: this.systemPrompt, content: injectKnowledge(content, this.knowledgeContent) };
  }

  cleanResponse(raw: string): string {
    return this.rag().builder ? CitationPromptBuilder.cleanResponse(raw) : raw;
  }
}
