import { errorMessage } from '../../../shared/errors';
import { logger } from '../../../shared/logging/logger';
import { attempt } from '../../../shared/resilience/attempt';
import { ConversationStateKey, titleFrom, type ConversationStore } from '../../conversation-store';
import type { C4Session, C4SessionRepository } from '../application/interfaces/c4Sketch.interface';
import { InMemoryC4SessionRepository } from './inMemoryC4Session.repository';

const C4_TITLE_FALLBACK = '/c4';

/**
 * Paused C4 runs: in memory for speed, and in `conversations.state.pendingC4`
 * when the run belongs to a conversation — so a Render restart between the
 * questions and the user's answers no longer loses the run. Images are not
 * persisted (they are already artifacts of the conversation).
 */
export class ConversationC4SessionRepository implements C4SessionRepository {
  constructor(
    private readonly memory: InMemoryC4SessionRepository,
    private readonly store: ConversationStore,
    private readonly now: () => number = Date.now,
  ) {}

  async save(session: C4Session): Promise<void> {
    await this.memory.save(session);
    if (!session.conversationId) return;
    const persisted = { ...session, request: { ...session.request, images: [] } } as unknown as Record<string, unknown>;
    const saved = await attempt(() => this.store.setState(session.conversationId!, ConversationStateKey.PENDING_C4, persisted, titleFrom(session.request.description, C4_TITLE_FALLBACK)));
    if (!saved.ok) logger.warn(`[c4] could not persist session ${session.id}: ${errorMessage(saved.error)} — kept in memory only`);
  }

  async take(id: string): Promise<C4Session | undefined> {
    const inMemory = await this.memory.take(id);
    if (inMemory && !inMemory.conversationId) return inMemory;
    // Also clears the persisted copy when the session was found in memory.
    const stored = await attempt(() => this.store.takeStateById(ConversationStateKey.PENDING_C4, id));
    if (!stored.ok) logger.warn(`[c4] could not read session ${id} from the conversation store: ${errorMessage(stored.error)}`);
    if (inMemory) return inMemory;
    if (!stored.ok || !stored.value) return undefined;
    const session = stored.value.value as unknown as C4Session;
    if (typeof session.expiresAt !== 'number' || session.expiresAt <= this.now()) return undefined;
    return { ...session, request: { ...session.request, images: session.request?.images ?? [] }, conversationId: stored.value.conversationId };
  }
}
