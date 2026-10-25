import { errorMessage } from '../../../shared/errors';
import { logger } from '../../../shared/logging/logger';
import { attempt } from '../../../shared/resilience/attempt';
import { injectKnowledge } from '../domain/knowledgeInjection';
import { RagAvailability } from './ragAvailability.service';
import { PromptContent } from '../domain/interfaces/promptContent.interface';
import { PreparedPrompt } from './interfaces/promptPreparer.interface';

/** Builds the final prompt: RAG context when available, otherwise knowledge.md. */
export class PromptPreparer {
  constructor(
    private readonly systemPrompt: string,
    private readonly knowledgeContent: string,
    private readonly rag: RagAvailability = new RagAvailability(),
  ) {}

  async prepare(content: PromptContent): Promise<PreparedPrompt> {
    const pipeline = this.rag.current();
    const question = content.textContent;
    if (!pipeline || !question.trim()) return this.withKnowledgeFile(content);

    const retrieval = await attempt(() => pipeline.retriever.retrieve(question));
    if (!retrieval.ok) {
      logger.warn(`RAG retrieval failed — falling back to knowledge.md: ${errorMessage(retrieval.error)}`);
      return this.withKnowledgeFile(content);
    }
    const chunks = retrieval.value;
    const prompt = pipeline.builder.build(this.systemPrompt, chunks, question);
    return { systemPrompt: prompt.systemPrompt, content: { ...content, textContent: prompt.userContent }, contexts: chunks };
  }

  cleanResponse(raw: string): string {
    const pipeline = this.rag.current();
    return pipeline ? pipeline.builder.cleanResponse(raw) : raw;
  }

  private withKnowledgeFile(content: PromptContent): PreparedPrompt {
    return { systemPrompt: this.systemPrompt, content: injectKnowledge(content, this.knowledgeContent), contexts: [] };
  }
}
