import type { PromptImage } from '../../../ai';
import type { ArtifactKind, ConversationSnapshot, MessageKind, MessageRole, NewMessage } from '../../../conversation-store';

/** An artifact produced by a turn: bytes go to object storage, small structured data inline. */
export interface RecordedArtifact {
  kind: ArtifactKind;
  /** The message it belongs to: the user's (images sent) or the assistant's (C4 output). */
  owner: MessageRole;
  bytes?: Buffer;
  mime?: string;
  /** Set for user images: captioned/OCR'd in the background when no note exists yet. */
  image?: PromptImage;
  caption?: string;
  ocrText?: string;
  dataJson?: unknown;
  /** Readable name; generated from kind/system/level/version/turn when absent. */
  label?: string;
  /** C4 level of a PNG/PUML (a spec's levels come from its data_json). */
  level?: string;
  /** Design name for the label and the version chain (defaults to `dataJson.systemName`). */
  systemName?: string;
  /** Version chain: set by revisions; inferred (same kind + same system) when absent. */
  parentArtifactId?: string;
  version?: number;
  /** design_note only: the turn text the aux model refines into data_json in the background. */
  designSource?: { question: string; answer: string };
}

export interface TurnRecordInput {
  conversationId: string;
  /** What `begin`/`open` read (null for a new conversation): base for the compaction check. */
  snapshot: ConversationSnapshot | null;
  kind: MessageKind;
  userText: string;
  assistantText: string;
  assistantMeta?: Partial<Pick<NewMessage, 'provider' | 'model' | 'mode' | 'promptVersion' | 'latencyMs' | 'ttftMs' | 'tokensIn' | 'tokensOut' | 'tokensCached' | 'sources' | 'resolvedRefs'>>;
  artifacts: RecordedArtifact[];
  /** Conversation state changes in the same transaction (e.g. clear `pendingC4`). */
  state?: Record<string, unknown | null>;
  /** Intent router decision (C4 turns): stored on both messages (`messages.intent`, migration 008). */
  intent?: { intent: string; confidence: number };
}
