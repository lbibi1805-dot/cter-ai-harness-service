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
}

export interface TurnRecordInput {
  conversationId: string;
  /** What `begin`/`open` read (null for a new conversation): base for the compaction check. */
  snapshot: ConversationSnapshot | null;
  kind: MessageKind;
  userText: string;
  assistantText: string;
  assistantMeta?: Partial<Pick<NewMessage, 'provider' | 'model' | 'mode' | 'promptVersion' | 'latencyMs' | 'ttftMs' | 'tokensIn' | 'tokensOut' | 'sources'>>;
  artifacts: RecordedArtifact[];
  /** Conversation state changes in the same transaction (e.g. clear `pendingC4`). */
  state?: Record<string, unknown | null>;
}
