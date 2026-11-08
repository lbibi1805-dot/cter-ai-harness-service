import { errorMessage } from '../../../shared/errors';
import { logger } from '../../../shared/logging/logger';
import { attempt } from '../../../shared/resilience/attempt';
import { CITATION_RULES } from '../../retrieval/application/constants/citationPrompt.constants';
import { injectKnowledge } from '../domain/knowledgeInjection';
import { retrievalQuery } from '../domain/helpers/conversationHistory.helper';
import { RagAvailability } from './ragAvailability.service';
import { PromptContent } from '../domain/interfaces/promptContent.interface';
import { PreparedPrompt } from './interfaces/promptPreparer.interface';
import { composeStaticSystemPrompt, placeMemory } from '../domain/helpers/promptLayers.helper';
import { PromptCacheLayout } from '../domain/enums/promptLayout.enums';
import { DEFAULT_PROMPT_CACHE_LAYOUT } from '../domain/constants/promptLayers.constants';

/** Builds the final prompt: RAG context when available, otherwise knowledge.md. */
export class PromptPreparer {
  /** Layer ① in layout V2: computed once, byte-identical for every request and both paths. */
  private readonly staticSystemPrompt: string;

  constructor(
    private readonly systemPrompt: string,
    private readonly knowledgeContent: string,
    private readonly rag: RagAvailability = new RagAvailability(),
    private readonly layout: PromptCacheLayout = DEFAULT_PROMPT_CACHE_LAYOUT,
  ) {
    this.staticSystemPrompt = layout === PromptCacheLayout.V2 ? composeStaticSystemPrompt(systemPrompt, CITATION_RULES) : systemPrompt;
  }

  /**
   * Layers, static → dynamic.
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
    const system = this.layout === PromptCacheLayout.V2 ? this.staticSystemPrompt : prompt.systemPrompt;
    const placed = placeMemory(system, { ...content, textContent: prompt.userContent }, this.layout);
    return {
      systemPrompt: placed.systemPrompt,
      content: { ...content, textContent: placed.textContent },
      contexts: chunks,
    };
  }

  cleanResponse(raw: string): string {
    const pipeline = this.rag.current();
    return pipeline ? pipeline.builder.cleanResponse(raw) : raw;
  }

  private withKnowledgeFile(content: PromptContent): PreparedPrompt {
    const placed = placeMemory(this.staticSystemPrompt, content, this.layout);
    const injected = injectKnowledge({ ...content, textContent: placed.textContent }, this.knowledgeContent);
    return { systemPrompt: placed.systemPrompt, content: injected, contexts: [] };
  }
}
