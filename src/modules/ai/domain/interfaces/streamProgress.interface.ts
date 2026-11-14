import type { AnswerEventType } from '../enums/streamProgress.enums';
import type { ProgressStage } from '../enums/streamProgress.enums';

/**
 * What a streamed answer is doing while it has no text to show (the model is
 * generating, the agent is reading a document). Machine-readable on purpose:
 * the HTTP layer names the event and the client words it.
 */
export interface StreamProgress {
  stage: ProgressStage;
  /** Extra detail for the stage, e.g. the tool name for AGENT_TOOL. */
  detail?: string;
}

export type ProgressListener = (progress: StreamProgress) => void;

/** One structural event of a long answer (12/11 plan 08); the HTTP layer writes it as an NDJSON line `{ type, … }`. */
export type AnswerStreamEvent =
  | { type: AnswerEventType.ANSWER_PLAN; total: number; questions: { id: string; label: string }[] }
  | { type: AnswerEventType.SECTION; index: number; total: number }
  | { type: AnswerEventType.CONTINUATION; n: number }
  | { type: AnswerEventType.COVERAGE; missing: string[] };

export type AnswerEventListener = (event: AnswerStreamEvent) => void;
