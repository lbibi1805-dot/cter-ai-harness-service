import type { ArtifactKind, MessageKind, MessageRole, ResolvedRefSource } from '../enums/conversation.enums';

/** What the artifact resolver picked for a question (`messages.resolved_refs`, monitoring/debug). */
export interface ResolvedRefs {
  /** Artifact aliases ("A7") the answer was grounded on (the candidates shown, when ambiguous). */
  ids: string[];
  source: ResolvedRefSource;
  /** Rule score per alias (top candidates only). */
  scores?: Record<string, number>;
}

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
  /** Prompt tokens served from the provider's prompt cache (note 18). */
  tokensCached: number | null;
  ttftMs: number | null;
  latencyMs: number | null;
  sources: unknown;
  resolvedRefs: ResolvedRefs | null;
  /** Intent router decision of a C4 turn (`c4_generate`, `c4_review`…; migration 008); null for chat. */
  intent: string | null;
  intentConfidence: number | null;
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
  /** Short readable name generated on write: `C4 container · Hệ thống đặt vé · v2` (migration 007). */
  label?: string | null;
  /** C4 level (`container`), `+`-joined for a multi-level spec; null when not a diagram. */
  level?: string | null;
  /** Who produced it: the user (images) or the assistant (C4 output, design notes). */
  owner?: MessageRole | null;
  /** Previous version of the same design (version chain; set by revisions). */
  parentArtifactId?: string | null;
  /** 1 for a first version. */
  version?: number;
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
  /** Keys of `conversations.state` holding a pending workflow (`pendingC4` = waiting for the user's answers). */
  pending: string[];
}

export interface ConversationDetail extends ConversationListItem {
  createdAt: string;
  summary: string | null;
  summaryUptoSeq: number;
  /** Pending workflows (`pendingC4`), as stored. */
  state: Record<string, unknown>;
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
  tokensCached?: number;
  ttftMs?: number;
  latencyMs?: number;
  sources?: unknown;
  resolvedRefs?: ResolvedRefs;
  intent?: string;
  intentConfidence?: number;
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
  label?: string;
  level?: string;
  owner?: MessageRole;
  parentArtifactId?: string;
  version?: number;
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

/** Background update of an artifact (aux model output); absent fields keep their value. */
export interface ArtifactEnrichment {
  id: string;
  caption?: string;
  ocrText?: string;
  dataJson?: unknown;
  label?: string;
}

/** Artifacts loaded outside the newest-N window (design kinds: few and small). */
export interface PinnedArtifactsOptions {
  kinds: readonly string[];
  /** Safety cap on pinned rows. */
  max: number;
}

export interface PendingWorkflow {
  conversationId: string;
  value: Record<string, unknown>;
}
