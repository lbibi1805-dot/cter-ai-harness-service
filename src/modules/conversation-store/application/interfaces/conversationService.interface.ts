import type { ArtifactDetail, ConversationDetail, ConversationListItem, MessagePage } from '../../domain';

export interface ConversationServiceOptions {
  /** Restore window before a soft-deleted conversation is purged (CONVERSATION_PURGE_DAYS). */
  purgeDays: number;
  /** Max conversations purged per maintenance run. */
  purgeBatch: number;
  /** Maintenance runs at most this often (piggyback on requests). */
  maintenanceIntervalMs: number;
  presignTtlSeconds: number;
  /** Messages returned by GET /api/conversations/:id without `?messages=`. */
  maxMessages: number;
  now: () => number;
}

export interface ArtifactView extends ArtifactDetail {
  /** Presigned (R2) or API download URL; null when the artifact has no file. */
  url: string | null;
}

export interface ConversationView extends Omit<ConversationDetail, 'artifacts'> {
  artifacts: ArtifactView[];
}

export interface StoredObjectRef {
  objectKey: string;
  sha256: string;
  sizeBytes: number;
}

export interface ConversationListRequest {
  limit: number;
  deleted: boolean;
  /** `?pending=` value (`c4`). */
  pending?: string;
  /** Opaque `?cursor=` from a previous page's `nextCursor`. */
  cursor?: string;
}

export interface ConversationListView {
  conversations: ConversationListItem[];
  nextCursor: string | null;
}

export interface MessagePageView extends Omit<MessagePage, 'artifacts'> {
  artifacts: ArtifactView[];
}
