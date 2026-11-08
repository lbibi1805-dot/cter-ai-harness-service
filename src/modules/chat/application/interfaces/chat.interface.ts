import type { AuxResolver } from '../../../context/domain/interfaces/artifactResolver.interface';
import type { EssayAnalysisSource, EssayAnswer, EssayDetails, EssayRequest, EssayRequestOptions } from '../../../essay';
import type { ChatTurnRecord, ChatTurns } from './chatTurns.interface';
import type { AnswerMode, AnswerResult } from '../../../agent/domain';
import { type AIProvider, type PerProvider, type PromptContent } from '../../../ai';

export interface ChatQuestion {
  provider: AIProvider;
  /** As sent by the client; resolved and validated here. */
  requestedModel?: string;
  mode: AnswerMode;
  content: PromptContent;
  includeTrace: boolean;
  /** Answer as NDJSON events (delta/reset/done) instead of one JSON body. */
  stream: boolean;
  /** Server-side conversation to continue; absent = new one (when the store is enabled). */
  conversationId?: string;
  /** Artifacts the user explicitly referenced in the composer (`A7`…), resolved by the context module. */
  refArtifactIds?: string[];
  /** Essay Mode requested (`mode: "essay"` or a `/essay` question, already stripped from `content.textContent`). */
  essay?: EssayRequestOptions;
}

/** One document the answer drew on, shown collapsed under the bubble ("📚 N nguồn"). */
export interface ChatSource {
  /** Vault path of the file. */
  file: string;
  /** Best-scoring heading of that file ('' when the whole file was read). */
  heading: string;
  /** Relevance in [0, 1] (reranker score when present, else vector similarity); null when unknown (agent file reads). */
  score: number | null;
}

/** Token usage of the answering attempt (from `answer.timings`). */
export interface ChatTokenUsage {
  tokensIn?: number;
  tokensOut?: number;
  tokensCached?: number;
}

/** The token fields of `AnswerTimings` the chat module reads (structural: no dependency on the full timings shape). */
export interface TimedAnswer {
  timings?: { inputTokens?: number; outputTokens?: number; cachedTokens?: number };
}

export interface ChatAnswer {
  question: ChatQuestion;
  /** The model the request was sent to (before any gateway fallback). */
  model: string;
  answer: AnswerResult;
  durationMs: number;
  /** Documents the answer drew on (deduped by file, best first). */
  sources: ChatSource[];
  /** Set when the conversation store is enabled. */
  conversation?: ChatTurnRecord;
  /** Essay Mode answers: outline, aspects, target length, coverage. */
  essay?: EssayDetails;
}

export interface ChatStatus {
  agentEnabled: boolean;
  /** True when the server keeps conversations: clients send `conversationId` instead of `history`. */
  conversations: boolean;
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
  /** Server-side memory; absent = stateless (client history). */
  turns?: ChatTurns;
  /** Essay Mode pipeline; absent (no retrieval) = essay requests are answered normally. */
  essay?: EssayWriter;
  /**
   * Essay Mode: a per-request aux session (intent router) whose ONE call answers both the artifact
   * resolver and the essay analysis. Absent / null = the essay pipeline analyses on its own.
   */
  essayAux?: (input: EssayAuxInput) => EssayAuxSession | null;
}

/** Artifact resolver + essay analysis from one aux call (routing's AuxRouterSession). */
export interface EssayAuxSession extends AuxResolver, EssayAnalysisSource {}

export interface EssayAuxInput {
  imageCount: number;
}

/** What the chat needs from the essay module (EssayService). */
export interface EssayWriter {
  readonly autoDetect: boolean;
  write(request: EssayRequest): Promise<EssayAnswer>;
}
