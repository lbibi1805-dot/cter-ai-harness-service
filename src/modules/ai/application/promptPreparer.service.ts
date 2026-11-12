import { errorMessage } from '../../../shared/errors';
import { logger } from '../../../shared/logging/logger';
import { attempt } from '../../../shared/resilience/attempt';
import { injectKnowledge } from '../domain/knowledgeInjection';
import { retrievalQuery } from '../domain/helpers/conversationHistory.helper';
import { RagAvailability } from './ragAvailability.service';
import { PromptContent } from '../domain/interfaces/promptContent.interface';
import { PreparedPrompt } from './interfaces/promptPreparer.interface';
import { placeMemory, withReminder } from '../domain/helpers/promptLayers.helper';
import { PromptCacheLayout } from '../domain/enums/promptLayout.enums';
import { DEFAULT_PROMPT_CACHE_LAYOUT } from '../domain/constants/promptLayers.constants';

/** Builds the final prompt: RAG context when available, otherwise knowledge.md. */
export class PromptPreparer {
  constructor(
    private readonly systemPrompt: string,
    private readonly knowledgeContent: string,
    private readonly rag: RagAvailability = new RagAvailability(),
    private readonly layout: PromptCacheLayout = DEFAULT_PROMPT_CACHE_LAYOUT,
    /** `prompts/policies/reminder.md`: static line after the question (12/11 02 Bước 3); empty = none. */
    private readonly reminder: string = '',
  ) {}

  /**
   * Layers, static → dynamic. The system prompt is the registry composition as is (every rule lives in `prompts/`);
   * the static reminder closes the user text.
   * V2 (default): ① static system prompt ② summary (first history turn) ④ history ③ artifact
   * registry ⑤ JIT artifacts ⑥ RAG context ⑦ question (+ images) — nothing dynamic before history.
   * V1: ① system prompt (+citation rules) + ②③ memory ④ history ⑤ JIT ⑥ RAG ⑦ question.
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
    const placed = placeMemory(prompt.systemPrompt, { ...content, textContent: prompt.userContent }, this.layout);
    return {
      systemPrompt: placed.systemPrompt,
      content: { ...content, textContent: withReminder(placed.textContent, this.reminder) },
      contexts: chunks,
    };
  }

  cleanResponse(raw: string): string {
    const pipeline = this.rag.current();
    return pipeline ? pipeline.builder.cleanResponse(raw) : raw;
  }

  private withKnowledgeFile(content: PromptContent): PreparedPrompt {
    const placed = placeMemory(this.systemPrompt, content, this.layout);
    const injected = injectKnowledge({ ...content, textContent: placed.textContent }, this.knowledgeContent);
    return { systemPrompt: placed.systemPrompt, content: { ...injected, textContent: withReminder(injected.textContent, this.reminder) }, contexts: [] };
  }
}
