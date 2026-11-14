import { AIInvocationService } from './application/aiInvocation.service';
import { PromptPreparer } from './application/promptPreparer.service';
import { ModelCatalog } from './domain/modelCatalog';
import { ConfiguredAIAdapterFactory } from './infrastructure/aiAdapter.factory';
import { RagAvailability } from './application/ragAvailability.service';
import type { AiModule, AiModuleConfig, AiModuleDeps } from './interfaces/aiModule.interface';

/** Wires the AI module: model catalog → adapters → prompt preparation → invocation with fallback. */
export function createAiModule(config: AiModuleConfig, deps: AiModuleDeps = {}): AiModule {
  const catalog = new ModelCatalog(config.ai);
  const configuredAdapters = new ConfiguredAIAdapterFactory(config.ai);
  const adapters = deps.adapters ?? configuredAdapters;
  const rag = new RagAvailability();
  const prompts = new PromptPreparer(config.systemPrompt, config.knowledgeContent, rag, config.promptLayout, config.reminder ?? '');
  const invocation = new AIInvocationService(config.ai, catalog, prompts, adapters, deps);
  return { catalog, adapters, configuredAdapters, rag, invocation, metrics: invocation.metrics, circuit: invocation.circuit };
}

export type { AiModule, AiModuleConfig, AiModuleDeps } from './interfaces/aiModule.interface';
export { PromptPreparer } from './application/promptPreparer.service';
export * from './domain/constants/ai.constants';
export * from './domain/enums/ai.enums';
export * from './domain/enums/streamProgress.enums';
export * from './domain/errors/ai.errors';
export * from './domain/interfaces/aiConfig.interface';
export * from './domain/interfaces/aiProvider.port';
export * from './domain/interfaces/streamProgress.interface';
export { perProvider } from './domain/helpers/perProvider.helper';
export * from './domain/promptContent';
export { ConfiguredAIAdapterFactory } from './infrastructure/aiAdapter.factory';
export { assertCompletion, buildRoutingFields, createOpenRouterClient } from './infrastructure/openrouter/openRouter.client';
export { OpenRouterModelDirectory } from './infrastructure/openrouter/openRouterModelDirectory';
export { toChatMessages, toResponsesHistory, toResponsesUserMessage } from './infrastructure/providers/openaiMessages';
export { renderHistory, currentUserParts, allPromptImages } from './domain/helpers/historyRender.helper';
export * from './domain/enums/historyRender.enums';
export type { RenderedHistory, RenderedPart, RenderedTurn } from './domain/interfaces/historyRender.interface';
export { configureHistoryLimits, normalizeHistory, retrievalQuery } from './domain/helpers/conversationHistory.helper';
export { clampOutputTokens } from './domain/helpers/outputLimit.helper';
export { MODEL_OUTPUT_LIMITS } from './domain/constants/modelOutputLimits.constants';
export { DEFAULT_HISTORY_ASSISTANT_TURN_MAX_CHARS, MAX_HISTORY_TURN_CHARS } from './domain/constants/conversation.constants';
export {
  withJit,
  withMemory,
  placeMemory,
  layoutConversationMemory,
  withReminder,
  summaryTurns,
} from './domain/helpers/promptLayers.helper';
export * from './domain/enums/promptLayout.enums';
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
export type { AIRequest, AnswerStream } from './application/interfaces/aiInvocation.interface';
export type { PreparedPrompt } from './application/interfaces/promptPreparer.interface';
export { ModelCatalog } from './domain/modelCatalog';
export type { KeyValidationResult } from './infrastructure/interfaces/aiAdapter.interface';
export type { RagPipeline } from './application/interfaces/promptPreparer.interface';
export { getOpenAIApiMode } from './domain/helpers/modelCatalog.helper';
export { PROVIDER_KEY_ENV } from './infrastructure/constants/aiAdapter.constants';
export type { AnswerTimings, AttemptTiming } from './domain/interfaces/answerTimings.interface';
export type { LatencyEntry, LatencyGroupSummary, LatencySummary, Percentiles } from './domain/interfaces/latencyRecorder.interface';
export type { ModelCircuitState } from './domain/interfaces/modelCircuit.interface';
export type { AiLatencySettings, ProviderTuning } from './domain/interfaces/latency.interface';
export * from './domain/enums/latency.enums';
export * from './domain/constants/latency.constants';
export { LatencyRecorder } from './application/latencyRecorder.service';
export { ModelCircuitBreaker } from './application/modelCircuit.service';
export { resolveLatencySettings, resolveProviderTuning } from './domain/helpers/latency.helper';
