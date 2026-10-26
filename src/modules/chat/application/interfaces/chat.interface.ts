import type { AnswerMode, AnswerResult } from '../../../agent/domain';
import { type AIProvider, type PerProvider, type PromptContent } from '../../../ai';

export interface ChatQuestion {
  provider: AIProvider;
  /** As sent by the client; resolved and validated here. */
  requestedModel?: string;
  mode: AnswerMode;
  content: PromptContent;
  includeTrace: boolean;
}

export interface ChatAnswer {
  question: ChatQuestion;
  /** The model the request was sent to (before any gateway fallback). */
  model: string;
  answer: AnswerResult;
  durationMs: number;
}

export interface ChatStatus {
  agentEnabled: boolean;
  providers: PerProvider<boolean>;
  defaultModels: PerProvider<string>;
  models: PerProvider<string[]>;
}

export interface ChatServiceOptions {
  /** False when CHAT_API_TOKEN is unset: the API fails closed. */
  enabled: boolean;
  agentEnabled: boolean;
  /** Whether credentials exist for the provider under the active gateway. */
  isProviderConfigured: (provider: AIProvider) => boolean;
}
