import { NotFoundError, ValidationError, errorMessage } from '../../../shared/errors';
import { logger } from '../../../shared/logging/logger';
import { attempt } from '../../../shared/resilience/attempt';
import { sha256Hex, type ObjectStorage } from '../../../shared/storage';
import {
  artifactObjectKey,
  conversationPrefix,
  decodeConversationCursor,
  encodeConversationCursor,
  extensionForMime,
  isUuid,
  normalizeDisplayTitle,
  PENDING_FILTERS,
  type ArtifactDetail,
  type ConversationListItem,
  type ConversationStore,
  type RenamedConversation,
} from '../domain';
import type {
  ArtifactView,
  ConversationListRequest,
  ConversationListView,
  ConversationServiceOptions,
  ConversationView,
  MessagePageView,
  StoredObjectRef,
} from './interfaces/conversationService.interface';
import {
  CONVERSATION_DETAIL_DEFAULT_MESSAGES,
  CONVERSATION_LIST_MAX_LIMIT,
  CONVERSATION_MESSAGES_MAX,
  DEFAULT_CONVERSATION_SERVICE_OPTIONS,
  INVALID_CURSOR_ERROR,
  INVALID_TITLE_ERROR,
  PENDING_STATE_PUBLIC_FIELDS,
} from './constants/conversationService.constants';

/**
 * Conversation API use cases (read, list, soft delete, restore, purge) and the
 * object-storage side of artifacts. Purging runs piggyback: right after a
 * request already woke the database, at most once per interval — never on a
 * timer of its own (Neon bills awake time).
 */
export class ConversationService {
  private readonly options: ConversationServiceOptions;
  private lastMaintenanceAt = 0;
  private maintenanceRunning = false;

  constructor(
    private readonly store: ConversationStore,
    private readonly storage: ObjectStorage,
    options: Partial<ConversationServiceOptions> = {},
  ) {
    this.options = { ...DEFAULT_CONVERSATION_SERVICE_OPTIONS, ...options };
  }

  get purgeDays(): number {
    return this.options.purgeDays;
  }

  /** `messages`: newest N (1–500); absent = `maxMessages` (500, what old clients always got). */
  async get(id: string, messages?: number): Promise<ConversationView> {
    assertId(id);
    const detail = await this.store.findActive(id, messages === undefined ? this.options.maxMessages : messageLimit(messages));
    if (!detail) throw new NotFoundError('Conversation not found');
    const artifacts = await this.toArtifactViews(detail.id, detail.artifacts);
    return { ...detail, state: publicState(detail.state), artifacts };
  }

  /** Older messages (seq < `beforeSeq`; newest page when absent) with the artifacts of those messages. */
  async messages(id: string, beforeSeq: number | undefined, limit = CONVERSATION_DETAIL_DEFAULT_MESSAGES): Promise<MessagePageView> {
    assertId(id);
    if (beforeSeq !== undefined && (!Number.isInteger(beforeSeq) || beforeSeq < 1)) throw new ValidationError('beforeSeq must be a positive integer');
    const page = await this.store.findMessages(id, beforeSeq ?? null, messageLimit(limit));
    if (!page) throw new NotFoundError('Conversation not found');
    return { ...page, artifacts: await this.toArtifactViews(id, page.artifacts) };
  }

  /** One keyset page, newest first. Bad cursor → 400 `invalid_cursor`; unknown `pending` → 400. */
  async listPage(request: ConversationListRequest): Promise<ConversationListView> {
    const after = request.cursor === undefined ? undefined : decodeConversationCursor(request.cursor);
    if (after === null) throw new ValidationError(INVALID_CURSOR_ERROR);
    const limit = Math.min(Math.max(Math.trunc(request.limit) || 1, 1), CONVERSATION_LIST_MAX_LIMIT);
    const page = await this.store.list({ limit, deleted: request.deleted, pending: pendingKey(request.pending), after });
    return { conversations: page.conversations, nextCursor: page.next ? encodeConversationCursor(page.next) : null };
  }

  /** First page only (callers that do not page). */
  async list(limit: number, deleted: boolean, pending?: string): Promise<ConversationListItem[]> {
    return (await this.listPage({ limit, deleted, pending })).conversations;
  }

  /** User title (`null`/`""` = back to the generated one). Does not move the conversation in the list. */
  async rename(id: string, title: unknown): Promise<RenamedConversation> {
    assertId(id);
    const displayTitle = normalizeDisplayTitle(title);
    if (displayTitle === undefined) throw new ValidationError(INVALID_TITLE_ERROR);
    const renamed = await this.store.rename(id, displayTitle);
    if (!renamed) throw new NotFoundError('Conversation not found');
    return renamed;
  }

  /** Soft delete (idempotent). Objects stay until the purge so a restore gets every image back. */
  async softDelete(id: string): Promise<void> {
    assertId(id);
    if (!(await this.store.softDelete(id, this.options.purgeDays))) throw new NotFoundError('Conversation not found');
  }

  async restore(id: string): Promise<void> {
    assertId(id);
    if (!(await this.store.restore(id))) throw new NotFoundError('Conversation not found (already purged?)');
  }

  /** Immediate purge: objects first, then rows (a crash in between leaves the row; the next purge finishes). */
  async hardDelete(id: string): Promise<void> {
    assertId(id);
    await this.storage.deletePrefix(conversationPrefix(id));
    if ((await this.store.deleteRows([id])) === 0) throw new NotFoundError('Conversation not found');
  }

  /** Bytes of one artifact (dev fallback when object storage has no presigned URLs). */
  async readArtifact(conversationId: string, artifactId: string): Promise<{ body: Buffer; mime: string }> {
    assertId(conversationId);
    if (!isUuid(artifactId)) throw new NotFoundError('Artifact not found');
    const artifact = await this.store.findActiveArtifact(conversationId, artifactId);
    if (!artifact?.objectKey) throw new NotFoundError('Artifact not found');
    const object = await this.storage.get(artifact.objectKey);
    if (!object) throw new NotFoundError('Artifact object missing');
    return { body: object.body, mime: artifact.mime ?? object.contentType ?? 'application/octet-stream' };
  }

  /** Uploads an artifact's bytes under `conversations/<id>/<artifactId>.<ext>`. */
  async putArtifactObject(conversationId: string, artifactId: string, body: Buffer, mime: string): Promise<StoredObjectRef> {
    const objectKey = artifactObjectKey(conversationId, artifactId, extensionForMime(mime));
    await this.storage.put(objectKey, body, { contentType: mime, metadata: { 'conversation-id': conversationId } });
    return { objectKey, sha256: sha256Hex(body), sizeBytes: body.length };
  }

  /** Fetches artifact bytes for the context assembler (JIT images). Null on any problem. */
  async fetchArtifactBytes(objectKey: string): Promise<Buffer | null> {
    const object = await attempt(() => this.storage.get(objectKey));
    return object.ok && object.value ? object.value.body : null;
  }

  /** Call after a request that touched the database: purges expired soft-deletes at most once per interval. */
  maybeRunMaintenance(): void {
    const now = this.options.now();
    if (this.maintenanceRunning || now - this.lastMaintenanceAt < this.options.maintenanceIntervalMs) return;
    this.lastMaintenanceAt = now;
    this.maintenanceRunning = true;
    void this.purgeExpired()
      .then((n) => { if (n > 0) logger.info(`[conversations] purged ${n} conversations past their restore window`); })
      .catch((err) => logger.warn(`[conversations] purge failed: ${errorMessage(err)}`))
      .finally(() => { this.maintenanceRunning = false; });
  }

  async purgeExpired(): Promise<number> {
    const ids = await this.store.findPurgeable(this.options.purgeBatch);
    const cleaned: string[] = [];
    for (const id of ids) {
      const removed = await attempt(() => this.storage.deletePrefix(conversationPrefix(id)));
      if (removed.ok) cleaned.push(id);
      else logger.warn(`[conversations] object purge failed for ${id}: ${errorMessage(removed.error)} — retry next time`);
    }
    return this.store.deleteRows(cleaned);
  }

  private toArtifactViews(conversationId: string, artifacts: ArtifactDetail[]): Promise<ArtifactView[]> {
    return Promise.all(artifacts.map((a) => this.toArtifactView(conversationId, a)));
  }

  private async toArtifactView(conversationId: string, artifact: ArtifactDetail): Promise<ArtifactView> {
    if (!artifact.objectKey) return { ...artifact, url: null };
    const url = await attempt(() => this.storage.presignGet(artifact.objectKey!, this.options.presignTtlSeconds));
    const presigned = url.ok ? url.value : null;
    return { ...artifact, url: presigned ?? `/api/conversations/${conversationId}/artifacts/${artifact.id}` };
  }
}

/** Pending workflows without their internals: step, questions, expiry. */
function publicState(state: Record<string, unknown>): Record<string, unknown> {
  const view: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(state ?? {})) {
    if (!value || typeof value !== 'object') continue;
    const pending = value as Record<string, unknown>;
    view[key] = Object.fromEntries(PENDING_STATE_PUBLIC_FIELDS.filter((f) => pending[f] !== undefined).map((f) => [f, pending[f]]));
  }
  return view;
}

/** `?pending=` value → state key; unknown values are a 400. */
function pendingKey(pending: string | undefined): string | undefined {
  if (pending === undefined) return undefined;
  const key = PENDING_FILTERS[pending];
  if (!key) throw new ValidationError(`pending must be one of: ${Object.keys(PENDING_FILTERS).join(', ')}`);
  return key;
}

/** Messages per page: 1–500 (larger values are capped). */
function messageLimit(value: number): number {
  if (!Number.isInteger(value) || value < 1) throw new ValidationError(`messages/limit must be an integer between 1 and ${CONVERSATION_MESSAGES_MAX}`);
  return Math.min(value, CONVERSATION_MESSAGES_MAX);
}

function assertId(id: string): void {
  if (!isUuid(id)) throw new ValidationError('conversationId must be a UUID');
}
