import { NotFoundError, ValidationError, errorMessage } from '../../../shared/errors';
import { logger } from '../../../shared/logging/logger';
import { attempt } from '../../../shared/resilience/attempt';
import { sha256Hex, type ObjectStorage } from '../../../shared/storage';
import {
  artifactObjectKey,
  conversationPrefix,
  extensionForMime,
  isUuid,
  type ConversationDetail,
  type ConversationListItem,
  type ConversationStore,
} from '../domain';
import type { ArtifactView, ConversationServiceOptions, ConversationView, StoredObjectRef } from './interfaces/conversationService.interface';
import { DEFAULT_CONVERSATION_SERVICE_OPTIONS } from './constants/conversationService.constants';

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

  async get(id: string): Promise<ConversationView> {
    const detail = await this.requireActive(id);
    const artifacts = await Promise.all(detail.artifacts.map((a) => this.toArtifactView(detail.id, a)));
    return { ...detail, artifacts };
  }

  list(limit: number, deleted: boolean): Promise<ConversationListItem[]> {
    return this.store.list(limit, deleted);
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
    const detail = await this.requireActive(conversationId);
    const artifact = detail.artifacts.find((a) => a.id === artifactId);
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

  private async requireActive(id: string): Promise<ConversationDetail> {
    assertId(id);
    const detail = await this.store.findActive(id, this.options.maxMessages);
    if (!detail) throw new NotFoundError('Conversation not found');
    return detail;
  }

  private async toArtifactView(conversationId: string, artifact: ConversationDetail['artifacts'][number]): Promise<ArtifactView> {
    if (!artifact.objectKey) return { ...artifact, url: null };
    const url = await attempt(() => this.storage.presignGet(artifact.objectKey!, this.options.presignTtlSeconds));
    const presigned = url.ok ? url.value : null;
    return { ...artifact, url: presigned ?? `/api/conversations/${conversationId}/artifacts/${artifact.id}` };
  }
}

function assertId(id: string): void {
  if (!isUuid(id)) throw new ValidationError('conversationId must be a UUID');
}
