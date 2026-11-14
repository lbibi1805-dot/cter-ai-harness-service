import type { ConversationStore } from '../domain/conversationStore.port';
import { TitleSource } from '../domain/enums/conversation.enums';
import type {
  ArtifactDetail,
  ArtifactEnrichment,
  ConversationCursor,
  ConversationDetail,
  ConversationListPage,
  ConversationListQuery,
  ConversationSnapshot,
  MessageDetail,
  MessagePage,
  PendingWorkflow,
  PinnedArtifactsOptions,
  RenamedConversation,
  TurnWrite,
} from '../domain/interfaces/conversation.interface';
import { pageOfMessages } from './helpers/conversationRow.helper';

interface MemoryConversation {
  id: string;
  title: string | null;
  /** User-given name (migration 009); null = show `title`. */
  displayTitle: string | null;
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

  async load(id: string, maxMessages: number, maxArtifacts: number, pinned?: PinnedArtifactsOptions): Promise<ConversationSnapshot | null> {
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
      artifacts: this.window(c, maxArtifacts, pinned).map((a) => ({ ...a, messageSeq: this.seqOf(c, a.messageId) })),
      artifactCount: c.artifacts.length,
    };
  }

  async recordTurn(turn: TurnWrite): Promise<void> {
    let c = this.conversations.get(turn.conversationId);
    if (!c) {
      c = { id: turn.conversationId, title: turn.title, displayTitle: null, summary: null, summaryUptoSeq: 0, state: {}, createdAt: this.now(), updatedAt: this.now(), deletedAt: null, purgeAfter: null, messages: [], artifacts: [] };
      this.conversations.set(c.id, c);
    }
    c.updatedAt = this.now();
    let seq = c.messages.at(-1)?.seq ?? 0;
    for (const m of turn.messages) {
      c.messages.push({
        id: m.id, seq: ++seq, role: m.role, kind: m.kind, text: m.text,
        provider: m.provider ?? null, model: m.model ?? null, mode: m.mode ?? null, promptVersion: m.promptVersion ?? null,
        tokensIn: m.tokensIn ?? null, tokensOut: m.tokensOut ?? null, tokensCached: m.tokensCached ?? null, ttftMs: m.ttftMs ?? null, latencyMs: m.latencyMs ?? null,
        sources: m.sources ?? null, resolvedRefs: m.resolvedRefs ?? null,
        intent: m.intent ?? null, intentConfidence: m.intentConfidence ?? null, createdAt: this.now().toISOString(),
      });
    }
    let ordinal = c.artifacts.at(-1)?.ordinal ?? 0;
    for (const a of turn.artifacts) {
      c.artifacts.push({
        id: a.id, ordinal: ++ordinal, kind: a.kind, messageId: a.messageId, messageSeq: null,
        objectKey: a.objectKey ?? null, mime: a.mime ?? null, caption: a.caption ?? null, ocrText: a.ocrText ?? null,
        dataJson: a.dataJson ?? null, sha256: a.sha256 ?? null, sizeBytes: a.sizeBytes ?? null, createdAt: this.now().toISOString(),
        label: a.label ?? null, level: a.level ?? null, owner: a.owner ?? null, parentArtifactId: a.parentArtifactId ?? null, version: a.version ?? 1,
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
    const c = this.active(id);
    if (!c) return null;
    return {
      id: c.id, ...titleOf(c), summary: c.summary, summaryUptoSeq: c.summaryUptoSeq, state: structuredClone(c.state),
      createdAt: c.createdAt.toISOString(), updatedAt: c.updatedAt.toISOString(), deletedAt: null, purgeAfter: null, pending: Object.keys(c.state),
      ...pageOfMessages(c.messages.slice(-(maxMessages + 1)).map((m) => ({ ...m })), maxMessages),
      artifacts: c.artifacts.map((a) => ({ ...a, messageSeq: this.seqOf(c, a.messageId) })),
    };
  }

  async findMessages(id: string, beforeSeq: number | null, limit: number): Promise<MessagePage | null> {
    const c = this.active(id);
    if (!c) return null;
    const older = c.messages.filter((m) => beforeSeq === null || m.seq < beforeSeq);
    const page = pageOfMessages(older.slice(-(limit + 1)).map((m) => ({ ...m })), limit);
    const shown = new Map(page.messages.map((m) => [m.id, m.seq]));
    const artifacts = c.artifacts.filter((a) => a.messageId && shown.has(a.messageId)).map((a) => ({ ...a, messageSeq: shown.get(a.messageId!)! }));
    return { ...page, artifacts };
  }

  async findActiveArtifact(conversationId: string, artifactId: string): Promise<ArtifactDetail | null> {
    const artifact = this.active(conversationId)?.artifacts.find((a) => a.id === artifactId);
    return artifact ? { ...artifact } : null;
  }

  async list(query: ConversationListQuery): Promise<ConversationListPage> {
    const rows = [...this.conversations.values()]
      .filter((c) => (query.deleted ? c.deletedAt !== null : c.deletedAt === null))
      .filter((c) => !query.pending || c.state[query.pending] !== undefined)
      .sort((a, b) => compareKey(b, a))
      .filter((c) => !query.after || compareKey(c, query.after) < 0)
      .slice(0, query.limit + 1);
    const page = rows.slice(0, query.limit);
    const last = page.at(-1);
    return {
      conversations: page.map((c) => ({
        id: c.id, ...titleOf(c), updatedAt: c.updatedAt.toISOString(), deletedAt: c.deletedAt?.toISOString() ?? null,
        purgeAfter: c.purgeAfter?.toISOString() ?? null, pending: Object.keys(c.state),
      })),
      next: rows.length > query.limit && last ? { updatedAt: last.updatedAt.toISOString(), id: last.id } : null,
    };
  }

  async rename(id: string, displayTitle: string | null): Promise<RenamedConversation | null> {
    const c = this.active(id);
    if (!c) return null;
    c.displayTitle = displayTitle;
    return { id: c.id, ...titleOf(c) };
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
          a.caption = u.caption ?? a.caption;
          a.ocrText = u.ocrText ?? a.ocrText;
          a.dataJson = u.dataJson ?? a.dataJson;
          a.label = u.label ?? a.label;
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

  /** Newest `max` artifacts plus the newest `pinned.max` of the pinned kinds (same rule as the SQL store), by ordinal. */
  private window(c: MemoryConversation, max: number, pinned?: PinnedArtifactsOptions): ArtifactDetail[] {
    const keep = new Set(c.artifacts.slice(-max).map((a) => a.id));
    const kinds = new Set<string>(pinned?.kinds ?? []);
    const pinnedRows = pinned?.max ? c.artifacts.filter((a) => kinds.has(a.kind)).slice(-pinned.max) : [];
    for (const a of pinnedRows) keep.add(a.id);
    return c.artifacts.filter((a) => keep.has(a.id));
  }

  private active(id: string): MemoryConversation | null {
    const c = this.conversations.get(id);
    return c && !c.deletedAt ? c : null;
  }

  private seqOf(c: MemoryConversation, messageId: string | null): number | null {
    return messageId ? c.messages.find((m) => m.id === messageId)?.seq ?? null : null;
  }
}

function titleOf(c: MemoryConversation): { title: string | null; titleSource: TitleSource } {
  return c.displayTitle !== null ? { title: c.displayTitle, titleSource: TitleSource.USER } : { title: c.title, titleSource: TitleSource.AUTO };
}

/** Same order as the SQL keyset: `(updated_at, id)`. */
function compareKey(a: MemoryConversation, b: MemoryConversation | ConversationCursor): number {
  const at = a.updatedAt.getTime();
  const bt = b.updatedAt instanceof Date ? b.updatedAt.getTime() : Date.parse(b.updatedAt);
  if (at !== bt) return at - bt;
  return a.id.toLowerCase() < b.id.toLowerCase() ? -1 : a.id.toLowerCase() > b.id.toLowerCase() ? 1 : 0;
}
