import type {
  ArtifactEnrichment,
  ConversationDetail,
  ConversationListItem,
  ConversationSnapshot,
  PendingWorkflow,
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
  /** Null when the id does not exist (never created, or purged). */
  load(id: string, maxMessages: number, maxArtifacts: number): Promise<ConversationSnapshot | null>;
  /** Creates the conversation when needed, appends messages (seq assigned in SQL) and artifacts. */
  recordTurn(turn: TurnWrite): Promise<void>;
  /** Active conversation with every message and artifact; null when missing or soft-deleted. */
  findActive(id: string, maxMessages: number): Promise<ConversationDetail | null>;
  list(limit: number, deleted: boolean): Promise<ConversationListItem[]>;
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
