import type { ConversationStore } from '../domain/conversationStore.port';
import type {
  ArtifactDetail,
  ArtifactEnrichment,
  ConversationDetail,
  ConversationListItem,
  ConversationSnapshot,
  MessageDetail,
  PendingWorkflow,
  TurnWrite,
} from '../domain/interfaces/conversation.interface';

interface MemoryConversation {
  id: string;
  title: string | null;
  summary: string | null;
  summaryUptoSeq: number;
  state: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  purgeAfter: Date | null;
  messages: MessageDetail[];
  artifacts: ArtifactDetail[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Conversations in process memory: tests, and dev without DATABASE_URL (lost on restart). */
export class InMemoryConversationStore implements ConversationStore {
  private readonly conversations = new Map<string, MemoryConversation>();

  constructor(private readonly now: () => Date = () => new Date()) {}

  async load(id: string, maxMessages: number, maxArtifacts: number): Promise<ConversationSnapshot | null> {
    const c = this.conversations.get(id);
    if (!c) return null;
    const unsummarized = c.messages.filter((m) => m.seq > c.summaryUptoSeq);
    return {
      id: c.id,
      title: c.title,
      summary: c.summary,
      summaryUptoSeq: c.summaryUptoSeq,
      state: structuredClone(c.state),
      deletedAt: c.deletedAt?.toISOString() ?? null,
      lastSeq: c.messages.at(-1)?.seq ?? 0,
      messages: unsummarized.slice(-maxMessages).map(({ id: mid, seq, role, kind, text }) => ({ id: mid, seq, role, kind, text })),
      artifacts: c.artifacts.slice(-maxArtifacts).map((a) => ({ ...a, messageSeq: this.seqOf(c, a.messageId) })),
      artifactCount: c.artifacts.length,
    };
  }

  async recordTurn(turn: TurnWrite): Promise<void> {
    let c = this.conversations.get(turn.conversationId);
    if (!c) {
      c = { id: turn.conversationId, title: turn.title, summary: null, summaryUptoSeq: 0, state: {}, createdAt: this.now(), updatedAt: this.now(), deletedAt: null, purgeAfter: null, messages: [], artifacts: [] };
      this.conversations.set(c.id, c);
    }
    c.updatedAt = this.now();
    let seq = c.messages.at(-1)?.seq ?? 0;
    for (const m of turn.messages) {
      c.messages.push({
        id: m.id, seq: ++seq, role: m.role, kind: m.kind, text: m.text,
        provider: m.provider ?? null, model: m.model ?? null, mode: m.mode ?? null, promptVersion: m.promptVersion ?? null,
        tokensIn: m.tokensIn ?? null, tokensOut: m.tokensOut ?? null, ttftMs: m.ttftMs ?? null, latencyMs: m.latencyMs ?? null,
        sources: m.sources ?? null, createdAt: this.now().toISOString(),
      });
    }
    let ordinal = c.artifacts.at(-1)?.ordinal ?? 0;
    for (const a of turn.artifacts) {
      c.artifacts.push({
        id: a.id, ordinal: ++ordinal, kind: a.kind, messageId: a.messageId, messageSeq: null,
        objectKey: a.objectKey ?? null, mime: a.mime ?? null, caption: a.caption ?? null, ocrText: a.ocrText ?? null,
        dataJson: a.dataJson ?? null, sha256: a.sha256 ?? null, sizeBytes: a.sizeBytes ?? null, createdAt: this.now().toISOString(),
      });
    }
    if (turn.state) {
      for (const [key, value] of Object.entries(turn.state)) {
        if (value === null) delete c.state[key];
        else c.state[key] = structuredClone(value);
      }
    }
  }

  async findActive(id: string, maxMessages: number): Promise<ConversationDetail | null> {
    const c = this.conversations.get(id);
    if (!c || c.deletedAt) return null;
    return {
      id: c.id, title: c.title, summary: c.summary, summaryUptoSeq: c.summaryUptoSeq,
      createdAt: c.createdAt.toISOString(), updatedAt: c.updatedAt.toISOString(), deletedAt: null, purgeAfter: null,
      messages: c.messages.slice(-maxMessages).map((m) => ({ ...m })),
      artifacts: c.artifacts.map((a) => ({ ...a, messageSeq: this.seqOf(c, a.messageId) })),
    };
  }

  async list(limit: number, deleted: boolean): Promise<ConversationListItem[]> {
    return [...this.conversations.values()]
      .filter((c) => (deleted ? c.deletedAt !== null : c.deletedAt === null))
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, limit)
      .map((c) => ({ id: c.id, title: c.title, updatedAt: c.updatedAt.toISOString(), deletedAt: c.deletedAt?.toISOString() ?? null, purgeAfter: c.purgeAfter?.toISOString() ?? null }));
  }

  async softDelete(id: string, purgeAfterDays: number): Promise<boolean> {
    const c = this.conversations.get(id);
    if (!c) return false;
    c.deletedAt ??= this.now();
    c.purgeAfter ??= new Date(this.now().getTime() + purgeAfterDays * DAY_MS);
    return true;
  }

  async restore(id: string): Promise<boolean> {
    const c = this.conversations.get(id);
    if (!c) return false;
    c.deletedAt = null;
    c.purgeAfter = null;
    return true;
  }

  async findPurgeable(limit: number): Promise<string[]> {
    const now = this.now().getTime();
    return [...this.conversations.values()]
      .filter((c) => c.deletedAt && c.purgeAfter && c.purgeAfter.getTime() <= now)
      .slice(0, limit)
      .map((c) => c.id);
  }

  async deleteRows(ids: string[]): Promise<number> {
    let n = 0;
    for (const id of ids) if (this.conversations.delete(id)) n++;
    return n;
  }

  async enrichArtifacts(updates: ArtifactEnrichment[]): Promise<void> {
    for (const c of this.conversations.values()) {
      for (const a of c.artifacts) {
        const u = updates.find((x) => x.id === a.id);
        if (u) {
          a.caption = u.caption;
          a.ocrText = u.ocrText;
        }
      }
    }
  }

  async saveSummary(id: string, summary: string, uptoSeq: number, expectedUptoSeq: number): Promise<boolean> {
    const c = this.conversations.get(id);
    if (!c || c.summaryUptoSeq !== expectedUptoSeq) return false;
    c.summary = summary;
    c.summaryUptoSeq = uptoSeq;
    return true;
  }

  async setState(id: string, key: string, value: Record<string, unknown> | null, title: string): Promise<void> {
    if (!this.conversations.has(id)) await this.recordTurn({ conversationId: id, title, messages: [], artifacts: [] });
    const c = this.conversations.get(id)!;
    if (value === null) delete c.state[key];
    else c.state[key] = structuredClone(value);
  }

  async takeStateById(key: string, valueId: string): Promise<PendingWorkflow | null> {
    for (const c of this.conversations.values()) {
      const pending = c.state[key] as Record<string, unknown> | undefined;
      if (!c.deletedAt && pending && pending.id === valueId) {
        delete c.state[key];
        return { conversationId: c.id, value: pending };
      }
    }
    return null;
  }

  private seqOf(c: MemoryConversation, messageId: string | null): number | null {
    return messageId ? c.messages.find((m) => m.id === messageId)?.seq ?? null : null;
  }
}
