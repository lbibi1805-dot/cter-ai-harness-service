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
