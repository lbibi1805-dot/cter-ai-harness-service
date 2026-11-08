import type { IntentSource, RequestIntent } from '../enums/routing.enums';

/** What the rules look at (note 05 §2): flags, keywords, images, designs already in the conversation. */
export interface IntentInput {
  /** The request text (C4 description or chat question). */
  text: string;
  /** Sent through /c4 (or /api/c4): the request is about C4, never plain Q&A. */
  slash: boolean;
  /** `--review` flag. */
  reviewFlag: boolean;
  /** Intent the client asked for explicitly. */
  explicitIntent?: RequestIntent | null;
  imageCount: number;
  /** c4_spec artifacts already in the conversation. */
  designCount: number;
  /** Explicit `refArtifactIds` sent by the client. */
  refCount: number;
}

export interface IntentDecision {
  intent: RequestIntent;
  /** 0..1. */
  confidence: number;
  source: IntentSource;
  /** Short reason (logs, monitoring). */
  reason?: string;
}

/** Command cues found in the head of the text. */
export interface IntentCues {
  review: boolean;
  revise: boolean;
  draw: boolean;
}
