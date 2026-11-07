import { MAX_C4_SESSIONS } from '../application/constants/c4Sketch.constants';
import type { C4Session, C4SessionRepository } from '../application/interfaces/c4Sketch.interface';

/** Paused C4 runs in process memory: the service runs as one instance, and a lost session only means "send /c4 again". */
export class InMemoryC4SessionRepository implements C4SessionRepository {
  private readonly sessions = new Map<string, C4Session>();

  constructor(private readonly now: () => number = Date.now) {}

  async save(session: C4Session): Promise<void> {
    this.dropExpired();
    while (this.sessions.size >= MAX_C4_SESSIONS) this.sessions.delete(this.sessions.keys().next().value!);
    this.sessions.set(session.id, session);
  }

  async take(id: string): Promise<C4Session | undefined> {
    this.dropExpired();
    const session = this.sessions.get(id);
    this.sessions.delete(id);
    return session;
  }

  private dropExpired(): void {
    const now = this.now();
    for (const [id, session] of this.sessions) if (session.expiresAt <= now) this.sessions.delete(id);
  }
}
