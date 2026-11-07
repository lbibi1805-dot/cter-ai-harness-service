import { randomUUID } from 'crypto';
import { NotFoundError, ValidationError, errorMessage } from '../../../shared/errors';
import { logger } from '../../../shared/logging/logger';
import { attempt } from '../../../shared/resilience/attempt';
import type { PromptImage } from '../../ai';
import type { ChatTurnInput, ChatTurnOutcome, ChatTurnRecord, ChatTurns, PreparedChatTurn } from '../../chat/application/interfaces/chatTurns.interface';
import {
  ArtifactKind,
  MessageKind,
  MessageRole,
  isUuid,
  titleFrom,
  type ConversationService,
  type ConversationSnapshot,
  type ConversationStore,
  type NewArtifact,
  type NewMessage,
  type StoredArtifact,
  type StoredMessage,
} from '../../conversation-store';
import { assembleContext, needsQueryRewrite } from '../domain/contextAssembler';
import type { ContextSettings, ImageNote } from '../domain/interfaces/context.interface';
import type { ContextJobs } from './contextJobs.service';
import type { RecordedArtifact, TurnRecordInput } from './interfaces/conversationTurn.interface';

const IMAGE_ONLY_TITLE = '(ảnh)';
const MAX_SOURCES_STORED = 20;

/**
 * One chat turn with server-side memory:
 * begin = 1 DB read (conversation + unsummarized messages + artifact registry)
 *         → Context Assembler (history, memory, JIT artifacts, RAG query);
 * finish = artifacts to object storage, then 1 DB transaction (messages + artifacts),
 *         then background jobs (captions/OCR, auto-compact) while the DB is awake.
 * A database problem never fails the answer: reads fall back to the client
 * history, writes are logged.
 */
export class ConversationTurnService implements ChatTurns {
  private readonly background = new Set<Promise<unknown>>();

  constructor(
    private readonly store: ConversationStore,
    private readonly conversations: ConversationService,
    private readonly jobs: ContextJobs,
    private readonly settings: ContextSettings,
    private readonly promptVersion: string,
    private readonly timeouts: { imageNoteSyncMs: number },
  ) {}

  async begin(input: ChatTurnInput): Promise<PreparedChatTurn> {
    const snapshot = await this.open(input.conversationId);
    const conversationId = input.conversationId ?? randomUUID();
    const question = input.question.trim();

    // An image-only question has nothing to search with: read the image first (bounded).
    const currentNotes: ImageNote[] = !question && input.images.length > 0 && this.jobs.enabled
      ? await this.jobs.describeImages(input.images, this.timeouts.imageNoteSyncMs)
      : [];
    const assembled = assembleContext({ snapshot, question, currentImageCount: input.images.length, currentImageNotes: currentNotes, settings: this.settings });
    const jitImages = await this.fetchImages(assembled.jitImages);

    const history = snapshot ? assembled.history : input.clientHistory;
    let retrievalQuery = assembled.retrievalQuery;
    if (needsQueryRewrite(question, history.length > 0)) {
      const rewritten = await this.jobs.rewriteQuery(question, history);
      if (rewritten) retrievalQuery = [rewritten, ...assembled.retrievalHints].join('\n');
    }

    const content = {
      textContent: question,
      imageBuffers: [...input.images, ...jitImages],
      history,
      memory: assembled.memory || undefined,
      jitContext: assembled.jitText || undefined,
      retrievalQuery: retrievalQuery || undefined,
    };
    return {
      conversationId,
      content,
      finish: (outcome) => this.finishChat(conversationId, snapshot, question, input.images, currentNotes, outcome),
    };
  }

  /**
   * Opens an existing conversation for another flow (C4): 404 when it was
   * soft-deleted. Returns the snapshot (null for a new or unreadable one).
   */
  async open(conversationId: string | undefined): Promise<ConversationSnapshot | null> {
    if (conversationId === undefined) return null;
    if (!isUuid(conversationId)) throw new ValidationError('conversationId must be a UUID');
    const loaded = await attempt(() => this.store.load(conversationId, this.settings.maxLoadMessages, this.settings.maxLoadArtifacts));
    if (!loaded.ok) {
      logger.warn(`[context] could not load conversation ${conversationId} (${errorMessage(loaded.error)}) — answering without stored memory`);
      return null;
    }
    if (loaded.value?.deletedAt) throw new NotFoundError('Conversation not found');
    return loaded.value;
  }

  /** Writes one turn (any flow): artifact files first, then one transaction; then background jobs. */
  async record(input: TurnRecordInput): Promise<ChatTurnRecord> {
    const userMessage: NewMessage = { id: randomUUID(), role: MessageRole.USER, kind: input.kind, text: input.userText };
    const assistantMessage: NewMessage = { id: randomUUID(), role: MessageRole.ASSISTANT, kind: input.kind, text: input.assistantText, ...input.assistantMeta };

    const stored = await this.storeArtifacts(input.conversationId, userMessage.id, assistantMessage.id, input.artifacts);
    const written = await attempt(() => this.store.recordTurn({
      conversationId: input.conversationId,
      title: titleFrom(input.userText, IMAGE_ONLY_TITLE),
      messages: [userMessage, assistantMessage],
      artifacts: stored.map((s) => s.row),
      ...(input.state ? { state: input.state } : {}),
    }));
    if (!written.ok) {
      logger.warn(`[context] could not save turn of ${input.conversationId}: ${errorMessage(written.error)} — answer returned anyway`);
      return { conversationId: input.conversationId, messageId: assistantMessage.id, persisted: false };
    }

    this.conversations.maybeRunMaintenance();
    this.runInBackground(() => this.afterTurn(input, stored, userMessage, assistantMessage));
    return { conversationId: input.conversationId, messageId: assistantMessage.id, persisted: true };
  }

  /** Resolves when background jobs started so far are done (tests, graceful shutdown). */
  async idle(): Promise<void> {
    while (this.background.size > 0) await Promise.allSettled([...this.background]);
  }

  private finishChat(conversationId: string, snapshot: ConversationSnapshot | null, question: string, images: PromptImage[], notes: ImageNote[], outcome: ChatTurnOutcome): Promise<ChatTurnRecord> {
    return this.record({
      conversationId,
      snapshot,
      kind: MessageKind.CHAT,
      userText: question,
      assistantText: outcome.text,
      assistantMeta: {
        provider: outcome.provider,
        model: outcome.model,
        mode: outcome.mode,
        promptVersion: this.promptVersion,
        latencyMs: Math.round(outcome.durationMs),
        ...(outcome.ttftMs !== undefined ? { ttftMs: Math.round(outcome.ttftMs) } : {}),
        sources: outcome.sources.slice(0, MAX_SOURCES_STORED).map((c) => ({ source: c.source, heading: c.heading, chunkId: c.chunkId, score: c.rerankScore ?? c.score ?? null })),
      },
      artifacts: images.map((image, i) => ({
        kind: ArtifactKind.USER_IMAGE,
        owner: MessageRole.USER,
        bytes: image.data,
        mime: image.mimeType,
        image,
        caption: notes[i]?.caption || undefined,
        ocrText: notes[i]?.ocrText || undefined,
      })),
    });
  }

  private async storeArtifacts(conversationId: string, userMessageId: string, assistantMessageId: string, artifacts: RecordedArtifact[]): Promise<{ row: NewArtifact; source: RecordedArtifact }[]> {
    const stored = await Promise.all(artifacts.map(async (artifact) => {
      const id = randomUUID();
      const messageId = artifact.owner === MessageRole.USER ? userMessageId : assistantMessageId;
      const row: NewArtifact = { id, messageId, kind: artifact.kind, caption: artifact.caption, ocrText: artifact.ocrText, dataJson: artifact.dataJson, mime: artifact.mime };
      if (artifact.bytes) {
        const put = await attempt(() => this.conversations.putArtifactObject(conversationId, id, artifact.bytes!, artifact.mime ?? 'application/octet-stream'));
        if (!put.ok) {
          logger.warn(`[context] artifact upload failed (${artifact.kind}): ${errorMessage(put.error)} — skipped`);
          return null;
        }
        Object.assign(row, put.value);
      }
      return { row, source: artifact };
    }));
    return stored.filter((s): s is { row: NewArtifact; source: RecordedArtifact } => s !== null);
  }

  /** Captions for new images, then auto-compaction — the DB is still awake from the turn's write. */
  private async afterTurn(input: TurnRecordInput, stored: { row: NewArtifact; source: RecordedArtifact }[], user: NewMessage, assistant: NewMessage): Promise<void> {
    const toDescribe = stored
      .filter((s) => s.source.image && !s.row.caption && !s.row.ocrText)
      .map((s) => ({ id: s.row.id, image: s.source.image! }));
    const described = await attempt(() => this.jobs.enrichArtifacts(toDescribe));
    if (!described.ok) logger.warn(`[context] caption job failed: ${errorMessage(described.error)}`);

    const snapshot = input.snapshot;
    const lastSeq = snapshot?.lastSeq ?? 0;
    const messages: StoredMessage[] = [
      ...(snapshot?.messages ?? []),
      { id: user.id, seq: lastSeq + 1, role: user.role, kind: user.kind, text: user.text },
      { id: assistant.id, seq: lastSeq + 2, role: assistant.role, kind: assistant.kind, text: assistant.text },
    ];
    const baseOrdinal = snapshot?.artifactCount ?? 0;
    const artifacts: StoredArtifact[] = [
      ...(snapshot?.artifacts ?? []),
      ...stored.map((s, i) => ({
        id: s.row.id, ordinal: baseOrdinal + i + 1, kind: s.row.kind, messageId: s.row.messageId,
        messageSeq: s.row.messageId === user.id ? lastSeq + 1 : lastSeq + 2,
        objectKey: s.row.objectKey ?? null, mime: s.row.mime ?? null, caption: s.row.caption ?? null, ocrText: s.row.ocrText ?? null, dataJson: s.row.dataJson ?? null,
      })),
    ];
    const compacted = await attempt(() => this.jobs.compactIfNeeded(input.conversationId, snapshot?.summary ?? null, snapshot?.summaryUptoSeq ?? 0, messages, artifacts));
    if (!compacted.ok) logger.warn(`[context] compaction job failed: ${errorMessage(compacted.error)}`);
  }

  private async fetchImages(artifacts: StoredArtifact[]): Promise<PromptImage[]> {
    const images = await Promise.all(artifacts.map(async (a) => {
      const bytes = a.objectKey ? await this.conversations.fetchArtifactBytes(a.objectKey) : null;
      return bytes ? { data: bytes, mimeType: a.mime ?? 'image/png' } : null;
    }));
    return images.filter((i): i is PromptImage => i !== null);
  }

  private runInBackground(job: () => Promise<void>): void {
    const run = job().catch((err) => logger.warn(`[context] background job failed: ${errorMessage(err)}`));
    this.background.add(run);
    void run.finally(() => this.background.delete(run));
  }
}
