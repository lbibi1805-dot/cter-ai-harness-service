import { AIInvocationService } from './application/aiInvocation.service';
import { PromptPreparer } from './application/promptPreparer.service';
import type { AiConfig } from './domain/interfaces/aiConfig.interface';
import type { AIAdapterFactory } from './domain/interfaces/aiProvider.port';
import { ModelCatalog } from './domain/modelCatalog';
import { ConfiguredAIAdapterFactory } from './infrastructure/aiAdapter.factory';
import { AIInvocationDeps } from './application/interfaces/aiInvocation.interface';
import { RagAvailability } from './application/ragAvailability.service';

export interface AiModuleConfig {
  ai: AiConfig;
  systemPrompt: string;
  knowledgeContent: string;
}

export interface AiModuleDeps extends AIInvocationDeps {
  /** Test hook; production builds adapters from `config.ai`. */
  adapters?: AIAdapterFactory;
}

export interface AiModule {
  catalog: ModelCatalog;
  adapters: AIAdapterFactory;
  /** Present only for the production factory (key validation, OpenRouter client). */
  configuredAdapters: ConfiguredAIAdapterFactory;
  /** Flip to "ready" once the vault is indexed; single-shot prompts then use RAG. */
  rag: RagAvailability;
  invocation: AIInvocationService;
}

/** Wires the AI module: model catalog → adapters → prompt preparation → invocation with fallback. */
export function createAiModule(config: AiModuleConfig, deps: AiModuleDeps = {}): AiModule {
  const catalog = new ModelCatalog(config.ai);
  const configuredAdapters = new ConfiguredAIAdapterFactory(config.ai);
  const adapters = deps.adapters ?? configuredAdapters;
  const rag = new RagAvailability();
  const prompts = new PromptPreparer(config.systemPrompt, config.knowledgeContent, rag);
  const invocation = new AIInvocationService(config.ai, catalog, prompts, adapters, deps);
  return { catalog, adapters, configuredAdapters, rag, invocation };
}

export { PromptPreparer } from './application/promptPreparer.service';
export * from './domain/constants/ai.constants';
export * from './domain/enums/ai.enums';
export * from './domain/errors/ai.errors';
export * from './domain/interfaces/aiConfig.interface';
export * from './domain/interfaces/aiProvider.port';
export { perProvider } from './domain/helpers/perProvider.helper';
export * from './domain/promptContent';
export { ConfiguredAIAdapterFactory } from './infrastructure/aiAdapter.factory';
export { assertCompletion, buildRoutingFields, createOpenRouterClient } from './infrastructure/openrouter/openRouter.client';
export { OpenRouterModelDirectory } from './infrastructure/openrouter/openRouterModelDirectory';
export { toChatMessages, toResponsesHistory } from './infrastructure/providers/openaiMessages';
export { normalizeHistory } from './domain/helpers/conversationHistory.helper';
export { AIInvocationService } from './application/aiInvocation.service';
export { RagAvailability } from './application/ragAvailability.service';
export { DIRECT_ALLOWED_MODELS } from './domain/constants/modelCatalog.constants';
export { OPENROUTER_KEY_ENV } from './infrastructure/constants/aiAdapter.constants';
export type { OpenRouterRoutingFields } from './infrastructure/interfaces/openRouter.interface';
export { PromptContent, ConversationTurn } from './domain/interfaces/promptContent.interface';
export { parseAIProvider } from './domain/helpers/ai.helper';
export { PromptImage } from './domain/interfaces/promptContent.interface';
export type { AIAnswer } from './application/interfaces/aiInvocation.interface';
export type { AIInvocationSettings } from './application/interfaces/aiInvocation.interface';
export type { AIRequest } from './application/interfaces/aiInvocation.interface';
export type { PreparedPrompt } from './application/interfaces/promptPreparer.interface';
export { ModelCatalog } from './domain/modelCatalog';
export type { KeyValidationResult } from './infrastructure/interfaces/aiAdapter.interface';
export type { RagPipeline } from './application/interfaces/promptPreparer.interface';
export { getOpenAIApiMode } from './domain/helpers/modelCatalog.helper';
export { PROVIDER_KEY_ENV } from './infrastructure/constants/aiAdapter.constants';
