import { type BackoffOptions, type Sleep } from '../../../../shared/resilience';
import type { FailureKind } from '../../../../shared/resilience/enums/resilience.enums';
import type { CitedChunk } from '../../../retrieval/domain/interfaces/retrieval.interface';
import { ModelRoute, type AIProvider } from '../../domain/enums/ai.enums';
import type { ProgressListener } from '../../domain/interfaces/streamProgress.interface';
import type { AiConfig } from '../../domain/interfaces/aiConfig.interface';
import type { AIAdapter, ProviderReply } from '../../domain/interfaces/aiProvider.port';
import type { AnswerTimings, AttemptTiming } from '../../domain/interfaces/answerTimings.interface';
import { PromptContent } from '../../domain/interfaces/promptContent.interface';
import type { LatencyRecorder } from '../latencyRecorder.service';
import type { ModelCircuitBreaker } from '../modelCircuit.service';
import type { StreamRelay } from './answerStream.interface';
import type { GeminiThinkingLevel, InvocationErrorKind } from '../../domain/enums/latency.enums';

export type AIInvocationSettings = Pick<AiConfig, 'maxRetryCount' | 'timeoutMs' | 'latency'>;

export interface AIInvocationDeps {
  sleep?: Sleep;
  backoff?: BackoffOptions;
  /** Clock for deadlines and timings (tests). */
  now?: () => number;
  metrics?: LatencyRecorder;
  circuit?: ModelCircuitBreaker;
}

export interface AIRequest {
  provider: AIProvider;
  /** Already resolved by the ModelCatalog (request model or the provider default). */
  model: string;
  content: PromptContent;
  /** Shown in logs, e.g. the file name or conversation key. */
  label: string;
  /** Streams the answer as it is produced; absent = one reply at the end (all polling flows). */
  stream?: AnswerStream;
  /** Stable prompt-cache key, normally the conversation id (OpenAI `prompt_cache_key`, see OPENAI_PROMPT_CACHE_KEY). */
  cacheKey?: string;
  /** Absolute deadline (epoch ms) for the whole call; default: start + CHAT_DEADLINE_MS. */
  deadlineAt?: number;
  /** Aborts every attempt (e.g. the client disconnected). */
  signal?: AbortSignal;
  /** Recorded as the latency entry's `kind` instead of the entry point (e.g. `chat`, `c4`, `aux`). */
  purpose?: string;
  /** Caps the answer below AI_MAX_OUTPUT_TOKENS for this call (tiny JSON answers such as the intent router). */
  maxOutputTokens?: number;
  /** Gemini thinking level for this call (Essay Mode: ESSAY_THINKING_LEVEL); absent = GEMINI_THINKING_LEVEL. */
  thinkingLevel?: GeminiThinkingLevel;
}

/**
 * A streamed answer. `reset` is called when a retry or fallback starts after text was already sent, so the
 * client drops the partial text; the final AIAnswer text (cleaned) is authoritative.
 */
export interface AnswerStream {
  delta(text: string): void;
  reset(): void;
  /** Optional: what the answer is doing while it has no text yet (model thinking, agent tool calls). */
  progress?: ProgressListener;
}

export interface AIAnswer {
  text: string;
  /** The model that produced `text`. */
  model: string;
  attempts: number;
  /** RAG chunks the prompt was built from (empty without RAG). */
  contexts: CitedChunk[];
  /** Whether the vendor API or the OpenRouter fallback answered. */
  route?: ModelRoute;
  /** Latency breakdown and token usage (07 §3.1). */
  timings?: AnswerTimings;
}

/** One route of the plan: an adapter and the models to try on it, in order. */
export interface RoutePlan {
  route: ModelRoute;
  adapter: AIAdapter;
  models: string[];
}

/** Mutable state of one invocation, shared by every attempt. */
export interface InvocationRun {
  request: AIRequest;
  startedAt: number;
  deadlineAt: number;
  relay?: StreamRelay;
  attempts: AttemptTiming[];
  /** Adapter calls made (circuit skips excluded). */
  calls: number;
  retrievalMs?: number;
  kind: string;
}

export type RouteOutcome =
  | { ok: true; reply: ProviderReply }
  | { ok: false; failure: RouteFailure };

export interface RouteFailure {
  error: unknown;
  kind: FailureKind;
  model: string;
  /** Stop everything (deadline, request aborted) instead of trying the next route. */
  final: boolean;
  /** Set when the deadline ended the call. */
  errorKind?: InvocationErrorKind;
}
