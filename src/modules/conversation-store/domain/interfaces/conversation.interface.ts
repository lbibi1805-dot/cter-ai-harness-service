import type { ArtifactKind, MessageKind, MessageRole } from '../enums/conversation.enums';

export interface StoredMessage {
  id: string;
  seq: number;
  role: MessageRole;
  kind: MessageKind;
  text: string;
}

/** Full message row (GET /api/conversations/:id). */
export interface MessageDetail extends StoredMessage {
  provider: string | null;
  model: string | null;
  mode: string | null;
  promptVersion: string | null;
  tokensIn: number | null;
  tokensOut: number | null;
  ttftMs: number | null;
  latencyMs: number | null;
  sources: unknown;
  createdAt: string;
}

/** One artifact: bytes on object storage (`objectKey`), small structured data inline (`dataJson`). */
export interface StoredArtifact {
  id: string;
  /** 1-based number inside the conversation: the `[A3]` alias the model sees. */
  ordinal: number;
  kind: ArtifactKind;
  messageId: string | null;
  /** Seq of the message the artifact belongs to (turn ≈ ceil(seq / 2)). */
  messageSeq: number | null;
  objectKey: string | null;
  mime: string | null;
  caption: string | null;
  ocrText: string | null;
  dataJson: unknown;
}

export interface ArtifactDetail extends StoredArtifact {
  sha256: string | null;
  sizeBytes: number | null;
  createdAt: string;
}

/**
 * What a turn needs to build its context, read in ONE query: the conversation,
 * its messages after the summary, the newest artifacts.
 */
export interface ConversationSnapshot {
  id: string;
  title: string | null;
  summary: string | null;
  summaryUptoSeq: number;
  state: Record<string, unknown>;
  deletedAt: string | null;
  lastSeq: number;
  /** Messages with seq > summaryUptoSeq, oldest first. */
  messages: StoredMessage[];
  /** Newest artifacts (registry), ordered by ordinal. */
  artifacts: StoredArtifact[];
  artifactCount: number;
}

export interface ConversationListItem {
  id: string;
  title: string | null;
  updatedAt: string;
  deletedAt: string | null;
  purgeAfter: string | null;
}

export interface ConversationDetail extends ConversationListItem {
  createdAt: string;
  summary: string | null;
  summaryUptoSeq: number;
  messages: MessageDetail[];
  artifacts: ArtifactDetail[];
}

export interface NewMessage {
  id: string;
  role: MessageRole;
  kind: MessageKind;
  text: string;
  provider?: string;
  model?: string;
  mode?: string;
  promptVersion?: string;
  tokensIn?: number;
  tokensOut?: number;
  ttftMs?: number;
  latencyMs?: number;
  sources?: unknown;
}

export interface NewArtifact {
  id: string;
  messageId: string;
  kind: ArtifactKind;
  objectKey?: string;
  mime?: string;
  sha256?: string;
  sizeBytes?: number;
  caption?: string;
  ocrText?: string;
  dataJson?: unknown;
}

/** Everything one turn writes — committed in ONE transaction. */
export interface TurnWrite {
  conversationId: string;
  /** Used only when the conversation is created by this turn. */
  title: string;
  messages: NewMessage[];
  artifacts: NewArtifact[];
  /** Replaces these keys of `conversations.state` (null removes the key). */
  state?: Record<string, unknown | null>;
}

export interface ArtifactEnrichment {
  id: string;
  caption: string;
  ocrText: string;
}

export interface PendingWorkflow {
  conversationId: string;
  value: Record<string, unknown>;
}
