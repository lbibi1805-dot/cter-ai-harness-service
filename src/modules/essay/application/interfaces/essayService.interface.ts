import type { AIAnswer, AIProvider, AIRequest, AnswerStream, PreparedPrompt, PromptContent } from '../../../ai';
import type { PromptCacheLayout } from '../../../ai/domain/enums/promptLayout.enums';
import type { DomainPrompt, PromptRegistry } from '../../../prompts';
import type { CandidateReranker, ChunkSource, CitedChunk } from '../../../retrieval';
import type { EssayDetails, EssayRequestOptions, EssaySettings } from '../../domain/interfaces/essay.interface';

/** What the essay pipeline needs from the AI module (AIInvocationService satisfies it). */
export interface EssayInvocation {
  answerPrepared(request: AIRequest, prompt: PreparedPrompt): Promise<AIAnswer>;
}

/** Picks one model essay of a course (vault `_exemplars/<course>/`); null when there is none. */
export interface ExemplarSource {
  find(course: string, question: string): Promise<string | null>;
}

/** Rubric lookup (the PromptRegistry); null registry = built-in defaults. */
export type EssayPromptRegistry = Pick<PromptRegistry, 'selectDomain' | 'essayRubric' | 'skill'>;

export interface EssayServiceDeps {
  invocation: EssayInvocation;
  /** Hybrid (vector + BM25) retrieval returning `topK` chunks per query. */
  createRetriever(topK: number): ChunkSource;
  reranker: CandidateReranker;
  /** AUX_PROVIDER / AUX_MODEL for steps ① and ⑦; null = heuristic analysis, no self-check. */
  aux: { provider: AIProvider; model: string } | null;
  registry: EssayPromptRegistry | null;
  exemplars: ExemplarSource | null;
  /** Static system prompt (layer ①) the writing call starts from. */
  systemPrompt: string;
  promptLayout: PromptCacheLayout;
  now?: () => number;
}

/** The essay block of the request's shared aux call (the intent router's combined answer). */
export interface SharedEssayAnalysis {
  /** The call failed (error / timeout): the pipeline may still run its own analysis call. */
  failed: boolean;
  /** The raw `essay` object; null = answered without a usable block (→ heuristic, no second call). */
  block: Record<string, unknown> | null;
}

/** Step ① from the request's single aux call (routing's AuxRouterSession satisfies it). */
export interface EssayAnalysisSource {
  essayAnalysis(question: string): Promise<SharedEssayAnalysis>;
}

export interface EssayRequest {
  provider: AIProvider;
  model: string;
  /** The turn's prompt content (history, JIT artifacts, retrieval query); `textContent` = the question. */
  content: PromptContent;
  options: EssayRequestOptions;
  label: string;
  stream?: AnswerStream;
  cacheKey?: string;
  signal?: AbortSignal;
  /** Step ① from the request's shared aux call; absent = the pipeline's own analysis call (aux) or the heuristic. */
  sharedAnalysis?: EssayAnalysisSource;
}

/** The answer (AIAnswer shape: `text` is the essay, `contexts` the cited chunks) plus the essay details. */
export interface EssayAnswer extends AIAnswer {
  essay: EssayDetails;
}

/** Inputs of the writing prompt. */
export interface EssayPromptParts {
  chunks: CitedChunk[];
  rubric: string;
  verbLines: string[];
  exemplar: string | null;
  subject: string;
  aspects: string[];
  targetWords: number;
  question: string;
}

export interface EssayRubricChoice {
  rubric: string;
  domain: DomainPrompt | null;
}

export type { EssaySettings };
