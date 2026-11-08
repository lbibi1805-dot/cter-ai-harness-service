import { errorMessage } from '../../../shared/errors';
import { logger } from '../../../shared/logging/logger';
import { attempt } from '../../../shared/resilience/attempt';
import type { PromptImage } from '../../ai';
import { ConversationStateKey, titleFrom, type ConversationStore } from '../../conversation-store';
import type { C4ImageStaging, C4Session, C4SessionRepository, C4StagedImage } from '../application/interfaces/c4Sketch.interface';
import { InMemoryC4SessionRepository } from './inMemoryC4Session.repository';

const C4_TITLE_FALLBACK = '/c4';

/**
 * Paused C4 runs: in memory for speed, and in `conversations.state.pendingC4`
 * when the run belongs to a conversation — so a Render restart between the
 * questions and the user's answers no longer loses the run. The request images
 * are staged in object storage (keys in the same state write: no extra DB
 * write) and loaded back when the in-memory copy is gone; the staged objects
 * are deleted when the session is taken (resumed or found expired).
 */
export class ConversationC4SessionRepository implements C4SessionRepository {
  constructor(
    private readonly memory: InMemoryC4SessionRepository,
    private readonly store: ConversationStore,
    private readonly now: () => number = Date.now,
    private readonly images: C4ImageStaging | null = null,
  ) {}

  async save(session: C4Session): Promise<void> {
    const imageKeys = session.conversationId ? await this.stage(session) : [];
    const withKeys: C4Session = imageKeys.length ? { ...session, imageKeys } : session;
    await this.memory.save(withKeys);
    if (!session.conversationId) return;
    const persisted = { ...withKeys, request: { ...session.request, images: [] } } as unknown as Record<string, unknown>;
    const saved = await attempt(() => this.store.setState(session.conversationId!, ConversationStateKey.PENDING_C4, persisted, titleFrom(session.request.description, C4_TITLE_FALLBACK)));
    if (!saved.ok) logger.warn(`[c4] could not persist session ${session.id}: ${errorMessage(saved.error)} — kept in memory only`);
  }

  async take(id: string): Promise<C4Session | undefined> {
    const inMemory = await this.memory.take(id);
    if (inMemory && !inMemory.conversationId) return inMemory;
    // Also clears the persisted copy when the session was found in memory.
    const stored = await attempt(() => this.store.takeStateById(ConversationStateKey.PENDING_C4, id));
    if (!stored.ok) logger.warn(`[c4] could not read session ${id} from the conversation store: ${errorMessage(stored.error)}`);
    if (inMemory) {
      await this.discard(inMemory.imageKeys);
      return inMemory;
    }
    if (!stored.ok || !stored.value) return undefined;
    const session = stored.value.value as unknown as C4Session;
    if (typeof session.expiresAt !== 'number' || session.expiresAt <= this.now()) {
      await this.discard(session.imageKeys);
      return undefined;
    }
    const images = await this.load(session);
    await this.discard(session.imageKeys);
    return { ...session, request: { ...session.request, images }, conversationId: stored.value.conversationId };
  }

  /** Stages the request images; a storage problem only means a resume after a restart runs without them. */
  private async stage(session: C4Session): Promise<C4StagedImage[]> {
    if (!this.images || session.request.images.length === 0) return [];
    const staged = await attempt(() => this.images!.stage(session.id, session.request.images));
    if (staged.ok) return staged.value;
    logger.warn(`[c4] could not stage ${session.request.images.length} image(s) of session ${session.id}: ${errorMessage(staged.error)} — a resume after a restart runs from the brief only`);
    return [];
  }

  private async load(session: C4Session): Promise<PromptImage[]> {
    const keys = session.imageKeys ?? [];
    if (keys.length === 0 || !this.images) return session.request?.images ?? [];
    const loaded = await attempt(() => this.images!.load(keys));
    if (loaded.ok && loaded.value) return loaded.value;
    logger.warn(`[c4] could not load the staged images of session ${session.id}${loaded.ok ? '' : `: ${errorMessage(loaded.error)}`} — resuming from the brief only`);
    return [];
  }

  private async discard(keys: C4StagedImage[] | undefined): Promise<void> {
    if (!this.images || !keys?.length) return;
    const removed = await attempt(() => this.images!.discard(keys));
    if (!removed.ok) logger.warn(`[c4] could not delete ${keys.length} staged image(s): ${errorMessage(removed.error)} — the tmp/ lifecycle rule removes them`);
  }
}
