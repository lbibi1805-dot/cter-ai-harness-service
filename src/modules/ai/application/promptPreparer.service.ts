import { errorMessage } from '../../../shared/errors';
import { logger } from '../../../shared/logging/logger';
import { attempt } from '../../../shared/resilience/attempt';
import { injectKnowledge } from '../domain/knowledgeInjection';
import { retrievalQuery } from '../domain/helpers/conversationHistory.helper';
import { RagAvailability } from './ragAvailability.service';
import { PromptContent } from '../domain/interfaces/promptContent.interface';
import { PreparedPrompt } from './interfaces/promptPreparer.interface';
import { withJit, withMemory } from '../domain/helpers/promptLayers.helper';

/** Builds the final prompt: RAG context when available, otherwise knowledge.md. */
export class PromptPreparer {
  constructor(
    private readonly systemPrompt: string,
    private readonly knowledgeContent: string,
    private readonly rag: RagAvailability = new RagAvailability(),
  ) {}

  /**
   * Layers, static → dynamic: ① system prompt (+citation rules) ② summary ③ artifact
   * registry (both as `memory`, at the end of the system prompt) ④ history ⑤ JIT
   * artifacts ⑥ RAG context ⑦ question (+ images).
   */
  async prepare(content: PromptContent): Promise<PreparedPrompt> {
    const pipeline = this.rag.current();
    const question = content.textContent;
    const query = content.retrievalQuery?.trim() || (question.trim() ? retrievalQuery(content) : '');
    if (!pipeline || !query) return this.withKnowledgeFile(content);

    const retrieval = await attempt(() => pipeline.retriever.retrieve(query));
    if (!retrieval.ok) {
      logger.warn(`RAG retrieval failed — falling back to knowledge.md: ${errorMessage(retrieval.error)}`);
      return this.withKnowledgeFile(content);
    }
    const chunks = retrieval.value;
    const prompt = pipeline.builder.build(this.systemPrompt, chunks, question);
    return {
      systemPrompt: withMemory(prompt.systemPrompt, content.memory),
      content: { ...content, textContent: withJit(prompt.userContent, content.jitContext) },
      contexts: chunks,
    };
  }

  cleanResponse(raw: string): string {
    const pipeline = this.rag.current();
    return pipeline ? pipeline.builder.cleanResponse(raw) : raw;
  }

  private withKnowledgeFile(content: PromptContent): PreparedPrompt {
    const injected = injectKnowledge({ ...content, textContent: withJit(content.textContent, content.jitContext) }, this.knowledgeContent);
    return { systemPrompt: withMemory(this.systemPrompt, content.memory), content: injected, contexts: [] };
  }
}
