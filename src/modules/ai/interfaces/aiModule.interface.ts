import type { AIInvocationService } from '../application/aiInvocation.service';
import type { LatencyRecorder } from '../application/latencyRecorder.service';
import type { ModelCircuitBreaker } from '../application/modelCircuit.service';
import type { RagAvailability } from '../application/ragAvailability.service';
import type { AIInvocationDeps } from '../application/interfaces/aiInvocation.interface';
import type { AiConfig } from '../domain/interfaces/aiConfig.interface';
import type { AIAdapterFactory } from '../domain/interfaces/aiProvider.port';
import type { ModelCatalog } from '../domain/modelCatalog';
import type { ConfiguredAIAdapterFactory } from '../infrastructure/aiAdapter.factory';
import type { PromptCacheLayout } from '../domain/enums/promptLayout.enums';

export interface AiModuleConfig {
  ai: AiConfig;
  systemPrompt: string;
  knowledgeContent: string;
  /** PROMPT_CACHE_LAYOUT (note 18 §4); default v2. */
  promptLayout?: PromptCacheLayout;
  /** `prompts/policies/reminder.md`: appended after the question (12/11 02 Bước 3). */
  reminder?: string;
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
  /** In-memory latency of every invocation: `metrics.summary(windowMs)` (for `/api/metrics/latency`). */
  metrics: LatencyRecorder;
  /** Models skipped by the circuit breaker: `circuit.snapshot()` (for `/api/ai-usage`). */
  circuit: ModelCircuitBreaker;
}
