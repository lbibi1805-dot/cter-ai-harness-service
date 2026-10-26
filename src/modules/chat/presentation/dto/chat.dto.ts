import { AnswerMode, type AnswerResult } from '../../../agent/domain';
import { type AIProvider } from '../../../ai';
import type { CitedChunk } from '../../../retrieval';

export interface RawImage {
  mimeType?: unknown;
  data?: unknown;
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
  trace?: ChatTraceDto;
}
