import type { ChunkRetriever } from '../../../rerank/domain/interfaces/reranker.port';
import type { CitationPromptBuilder } from '../../../retrieval/application/citationPrompt.builder';
import type { CitedChunk } from '../../../retrieval/domain/interfaces/retrieval.interface';
import { PromptContent } from '../../domain/interfaces/promptContent.interface';

export interface RagPipeline {
  retriever: ChunkRetriever;
  builder: CitationPromptBuilder;
}

export interface PreparedPrompt {
  systemPrompt: string;
  content: PromptContent;
  /** Chunks placed in the prompt; empty when knowledge.md was used instead. */
  contexts: CitedChunk[];
}
