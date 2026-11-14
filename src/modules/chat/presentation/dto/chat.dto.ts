import type { AnswerCompletenessDetails } from '../../../agent/domain';
import type { EssayDetails } from '../../../essay';
import type { TurnArtifactRef } from '../../application/interfaces/chatTurns.interface';
import { AnswerMode, type AnswerResult } from '../../../agent/domain';
import { type AIProvider, type AnswerTimings } from '../../../ai';
import type { CitedChunk } from '../../../retrieval';
import type { ChatSource } from '../../application/interfaces/chat.interface';

export interface RawImage {
  mimeType?: unknown;
  data?: unknown;
}

export interface RawHistoryTurn {
  role?: unknown;
  text?: unknown;
}

export interface ChatTraceDto {
  contexts: CitedChunk[];
  agent?: AnswerResult['agent'];
}

export interface ChatAnswerDto {
  text: string;
  provider: AIProvider;
  model: string;
  requestedMode: AnswerMode;
  mode: AnswerMode;
  fallbackReason: string | null;
  attempts: number;
  durationMs: number;
  /** Server-side conversation (when the store is enabled): send it back with the next question. */
  conversationId?: string;
  messageId?: string;
  persisted?: boolean;
  /** Artifacts this turn created (`[A7]` aliases for "↩ Hỏi về cái này"). */
  artifacts?: TurnArtifactRef[];
  /** Always present (possibly empty): files the answer drew on, best first, at most 6. */
  sources: ChatSource[];
  /** Where the time went (`answer.timings`) when the pipeline reports it. */
  timings?: AnswerTimings;
  /** Essay Mode only: the outline (with `[c:<chunkId>]` citations), aspects, target words, coverage (15). */
  essay?: EssayDetails;
  /** 12/11 plan 08: questions / sections / continuations / still-missing ids of an orchestrated answer. */
  completeness?: AnswerCompletenessDetails;
  trace?: ChatTraceDto;
}
