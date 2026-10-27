import { type BackoffOptions, type Sleep } from '../../../../shared/resilience';
import type { CitedChunk } from '../../../retrieval/domain/interfaces/retrieval.interface';
import { ModelRoute, type AIProvider } from '../../domain/enums/ai.enums';
import type { AiConfig } from '../../domain/interfaces/aiConfig.interface';
import type { ProviderReply } from '../../domain/interfaces/aiProvider.port';
import { PromptContent } from '../../domain/interfaces/promptContent.interface';

export type AIInvocationSettings = Pick<AiConfig, 'maxRetryCount' | 'timeoutMs'>;

export interface AIInvocationDeps {
  sleep?: Sleep;
  backoff?: BackoffOptions;
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
}

/**
 * A streamed answer. `reset` is called when a retry or fallback starts after text was already sent, so the
 * client drops the partial text; the final AIAnswer text (cleaned) is authoritative.
 */
export interface AnswerStream {
  delta(text: string): void;
  reset(): void;
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
}

export interface RouteResult {
  reply: ProviderReply;
  attempts: number;
}
