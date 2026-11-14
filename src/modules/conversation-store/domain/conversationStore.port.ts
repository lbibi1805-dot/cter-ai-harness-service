import type {
  ArtifactDetail,
  ArtifactEnrichment,
  ConversationDetail,
  ConversationListPage,
  ConversationListQuery,
  ConversationSnapshot,
  MessagePage,
  PendingWorkflow,
  PinnedArtifactsOptions,
  RenamedConversation,
  TurnWrite,
} from './interfaces/conversation.interface';

/**
 * Persistence of server-side conversations (Neon in prod). Each method is ONE
 * database round-trip, so a chat turn costs at most two: `load` + `recordTurn`.
 *
 * Soft delete: only `conversations.deleted_at` is set. Every read that serves
 * users filters `deleted_at IS NULL` here, in one place — callers never have
 * to remember it. `load` returns deleted rows only so the caller can answer 404
 * instead of silently re-creating the conversation.
 */
export interface ConversationStore {
  /**
   * Null when the id does not exist (never created, or purged). Artifacts = the newest
   * `maxArtifacts` plus every `pinned` kind (still ONE round-trip).
   */
  load(id: string, maxMessages: number, maxArtifacts: number, pinned?: PinnedArtifactsOptions): Promise<ConversationSnapshot | null>;
  /** Creates the conversation when needed, appends messages (seq assigned in SQL) and artifacts. */
  recordTurn(turn: TurnWrite): Promise<void>;
  /** Active conversation with its newest `maxMessages` messages and every artifact; null when missing or soft-deleted. */
  findActive(id: string, maxMessages: number): Promise<ConversationDetail | null>;
  /** Messages with seq < `beforeSeq` (all when null), newest `limit`, plus their artifacts; null when missing or soft-deleted. */
  findMessages(id: string, beforeSeq: number | null, limit: number): Promise<MessagePage | null>;
  /** One artifact of an active conversation (no messages loaded); null when either is missing or soft-deleted. */
  findActiveArtifact(conversationId: string, artifactId: string): Promise<ArtifactDetail | null>;
  /** Keyset page, newest first (`updated_at DESC, id DESC`); fetches `limit + 1` rows, never counts. */
  list(query: ConversationListQuery): Promise<ConversationListPage>;
  /** Sets (or clears with null) the user's title; never touches `updated_at`. Null when missing or soft-deleted. */
  rename(id: string, displayTitle: string | null): Promise<RenamedConversation | null>;
  /** Idempotent; false when the id does not exist. */
  softDelete(id: string, purgeAfterDays: number): Promise<boolean>;
  /** False when the id does not exist (already purged). */
  restore(id: string): Promise<boolean>;
  /** Soft-deleted conversations whose restore window is over. */
  findPurgeable(limit: number): Promise<string[]>;
  /** Hard delete (rows cascade to messages/artifacts). Object storage must be cleaned before. */
  deleteRows(ids: string[]): Promise<number>;
  enrichArtifacts(updates: ArtifactEnrichment[]): Promise<void>;
  /** Rolling summary; false when another compaction moved `summary_upto_seq` first. */
  saveSummary(id: string, summary: string, uptoSeq: number, expectedUptoSeq: number): Promise<boolean>;
  /** Sets (or clears with null) one state key, creating the conversation when needed. */
  setState(id: string, key: string, value: Record<string, unknown> | null, title: string): Promise<void>;
  /** Atomically removes and returns the pending workflow whose `value.id` matches. */
  takeStateById(key: string, valueId: string): Promise<PendingWorkflow | null>;
}
