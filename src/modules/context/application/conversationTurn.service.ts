import { randomUUID } from 'crypto';
import { NotFoundError, ValidationError, errorMessage } from '../../../shared/errors';
import { logger } from '../../../shared/logging/logger';
import { attempt } from '../../../shared/resilience/attempt';
import type { ConversationTurn, PromptContent, PromptImage } from '../../ai';
import { layoutConversationMemory } from '../../ai/domain/helpers/promptLayers.helper';
import type { ChatTurnInput, ChatTurnOutcome, ChatTurnRecord, ChatTurns, PreparedChatTurn } from '../../chat/application/interfaces/chatTurns.interface';
import {
  ArtifactKind,
  MessageKind,
  MessageRole,
  ResolvedRefSource,
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
import { createArtifactTools } from '../infrastructure/agentTools/artifactTools';
import { artifactAlias, artifactLabel, inferVersion, levelsOf, systemNameOf, turnOf } from '../domain/artifactMetadata';
import { resolveArtifactsWithAux, toResolvedRefs } from '../domain/artifactResolver';
import { LEVELS_JOINER } from '../domain/constants/context.constants';
import { assembleContext, needsQueryRewrite } from '../domain/contextAssembler';
import { heuristicDesignNote, isDesignAnswer } from '../domain/designNote';
import { chatPlantUmlArtifacts } from '../domain/chatPlantUml';
import type { AuxResolver, ResolveResult } from '../domain/interfaces/artifactResolver.interface';
import type { ContextSettings, HotWindowSlot, ImageNote } from '../domain/interfaces/context.interface';
import type { ContextJobs } from './contextJobs.service';
import type { DesignNoteJob } from './interfaces/contextJobs.interface';
import type { RecordedArtifact, TurnRecordInput } from './interfaces/conversationTurn.interface';

const IMAGE_ONLY_TITLE = '(ảnh)';
const MAX_SOURCES_STORED = 20;
/** Kinds that start a version chain (their PNG/PUML siblings share the version). */
const VERSIONED_KINDS = new Set<ArtifactKind>([ArtifactKind.C4_SPEC, ArtifactKind.DESIGN_NOTE]);

interface StoredRow {
  row: NewArtifact;
  source: RecordedArtifact;
}

/**
 * One chat turn with server-side memory:
 * begin = 1 DB read (conversation + unsummarized messages + newest artifacts + pinned design kinds)
 *         → artifact resolver (rules; aux only when ambiguous) → Context Assembler
 *         (history, memory, JIT artifacts, RAG query) → prompt layout (V1/V2);
 * finish = artifacts to object storage, then 1 DB transaction (messages + artifacts,
 *         incl. a design_note for a design answered in chat), then background jobs
 *         (captions/OCR, design-note extraction, auto-compact) while the DB is awake.
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
    private readonly auxResolver: AuxResolver | null = null,
  ) {}

  async begin(input: ChatTurnInput): Promise<PreparedChatTurn> {
    const snapshot = await this.open(input.conversationId);
    const conversationId = input.conversationId ?? randomUUID();
    const question = input.question.trim();

    // An image-only question has nothing to search with: read the image first (bounded).
    const currentNotes: ImageNote[] = !question && input.images.length > 0 && this.jobs.enabled
      ? await this.jobs.describeImages(input.images, this.timeouts.imageNoteSyncMs)
      : [];
    const resolution = await this.resolve(snapshot, question, input.refArtifactIds, input.auxResolver);
    const assembled = assembleContext({
      snapshot, question, currentImageCount: input.images.length, currentImageNotes: currentNotes, settings: this.settings, resolution,
    });
    // JIT images and the hot window (note 18 step 5) load in parallel; a missing object is skipped.
    const [jitImages, windowHistory] = await Promise.all([
      this.loadImages(assembled.jitImages),
      this.withHotWindow(assembled.history, assembled.hotWindow),
    ]);

    const history = snapshot ? windowHistory : input.clientHistory;
    let retrievalQuery = assembled.retrievalQuery;
    if (needsQueryRewrite(question, history.length > 0)) {
      const rewritten = await this.jobs.rewriteQuery(question, history);
      if (rewritten) retrievalQuery = [rewritten, ...assembled.retrievalHints].join('\n');
    }

    const base: PromptContent = {
      textContent: question,
      imageBuffers: [...input.images, ...jitImages],
      history,
      jitContext: assembled.jitText || undefined,
      retrievalQuery: retrievalQuery || undefined,
    };
    const content = layoutConversationMemory(base, { summary: assembled.summary, registry: assembled.registry, memoryV1: assembled.memory }, this.settings.promptLayout);
    const resolvedRefs = assembled.resolvedRefs ?? undefined;
    return {
      conversationId,
      content,
      snapshot,
      ...(snapshot && snapshot.artifacts.length > 0 ? { agentTools: createArtifactTools(() => snapshot) } : {}),
      ...(resolvedRefs ? { resolvedRefs } : {}),
      finish: (outcome) => this.finishChat({ conversationId, snapshot, question, images: input.images, notes: currentNotes, resolution, outcome }),
    };
  }

  /**
   * Opens an existing conversation for another flow (C4): 404 when it was
   * soft-deleted. Returns the snapshot (null for a new or unreadable one).
   */
  async open(conversationId: string | undefined): Promise<ConversationSnapshot | null> {
    if (conversationId === undefined) return null;
    if (!isUuid(conversationId)) throw new ValidationError('conversationId must be a UUID');
    const pinned = { kinds: this.settings.pinnedKinds, max: this.settings.maxPinnedArtifacts };
    const loaded = await attempt(() => this.store.load(conversationId, this.settings.maxLoadMessages, this.settings.maxLoadArtifacts, pinned));
    if (!loaded.ok) {
      logger.warn(`[context] could not load conversation ${conversationId} (${errorMessage(loaded.error)}) — answering without stored memory`);
      return null;
    }
    if (loaded.value?.deletedAt) throw new NotFoundError('Conversation not found');
    return loaded.value;
  }

  /** Writes one turn (any flow): artifact files first, then one transaction; then background jobs. */
  async record(input: TurnRecordInput): Promise<ChatTurnRecord> {
    const intent = input.intent ? { intent: input.intent.intent, intentConfidence: Math.round(input.intent.confidence * 1000) / 1000 } : {};
    const userMessage: NewMessage = { id: randomUUID(), role: MessageRole.USER, kind: input.kind, text: input.userText, ...intent };
    const assistantMessage: NewMessage = { id: randomUUID(), role: MessageRole.ASSISTANT, kind: input.kind, text: input.assistantText, ...input.assistantMeta, ...intent };

    const turn = turnOf((input.snapshot?.lastSeq ?? 0) + 1);
    const stored = await this.storeArtifacts(input.conversationId, userMessage.id, assistantMessage.id, input.artifacts, input.snapshot, turn);
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
    // Ordinals follow the store's numbering (append-only, same as afterTurn) → the `[A7]` alias of each new artifact.
    const baseOrdinal = input.snapshot?.artifactCount ?? 0;
    const artifactRefs = stored.map((s, i) => ({
      id: s.row.id, alias: `A${baseOrdinal + i + 1}`, kind: s.row.kind, label: s.row.label ?? s.row.kind,
      ...(s.row.level ? { level: s.row.level } : {}),
    }));

    this.conversations.maybeRunMaintenance();
    this.runInBackground(() => this.afterTurn(input, stored, userMessage, assistantMessage, turn));
    return { conversationId: input.conversationId, messageId: assistantMessage.id, persisted: true, ...(artifactRefs.length ? { artifacts: artifactRefs } : {}) };
  }

  /** Resolves when background jobs started so far are done (tests, graceful shutdown). */
  async idle(): Promise<void> {
    while (this.background.size > 0) await Promise.allSettled([...this.background]);
  }

  /** Rules (+ the aux resolver in rules+aux mode, only when ambiguous): which artifacts the question is about. */
  private async resolve(snapshot: ConversationSnapshot | null, question: string, refIds: string[] | undefined, aux?: AuxResolver): Promise<ResolveResult> {
    return resolveArtifactsWithAux(
      { question, artifacts: snapshot?.artifacts ?? [], messages: snapshot?.messages ?? [], refIds, settings: this.settings.resolver },
      aux ?? this.auxResolver,
    );
  }

  private finishChat(turn: {
    conversationId: string; snapshot: ConversationSnapshot | null; question: string; images: PromptImage[]; notes: ImageNote[];
    resolution: ResolveResult; outcome: ChatTurnOutcome;
  }): Promise<ChatTurnRecord> {
    const { outcome, question, notes } = turn;
    const artifacts: RecordedArtifact[] = turn.images.map((image, i) => ({
      kind: ArtifactKind.USER_IMAGE,
      owner: MessageRole.USER,
      bytes: image.data,
      mime: image.mimeType,
      image,
      caption: notes[i]?.caption || undefined,
      ocrText: notes[i]?.ocrText || undefined,
    }));
    // A design answered in chat becomes a design_note — unless the answer is about an artifact that already exists.
    const aboutExisting = turn.resolution.picked.length > 0 && turn.resolution.source !== ResolvedRefSource.NONE;
    if (!aboutExisting && isDesignAnswer(question, outcome.text, this.settings.designNoteMinChars)) {
      const note = heuristicDesignNote(question, outcome.text);
      artifacts.push({
        kind: ArtifactKind.DESIGN_NOTE, owner: MessageRole.ASSISTANT, dataJson: note, systemName: note.systemName || undefined,
        designSource: { question, answer: outcome.text },
      });
    }
    // A diagram edited in chat (```plantuml in the answer) → c4_puml artifact, continuing the picked design's version.
    artifacts.push(...chatPlantUmlArtifacts(outcome.text, aboutExisting ? turn.resolution.picked : []));
    return this.record({
      conversationId: turn.conversationId,
      snapshot: turn.snapshot,
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
        ...(outcome.tokensIn !== undefined ? { tokensIn: outcome.tokensIn } : {}),
        ...(outcome.tokensOut !== undefined ? { tokensOut: outcome.tokensOut } : {}),
        ...(outcome.tokensCached !== undefined ? { tokensCached: outcome.tokensCached } : {}),
        ...(turn.snapshot ? { resolvedRefs: toResolvedRefs(turn.resolution) } : {}),
        sources: outcome.sources.slice(0, MAX_SOURCES_STORED).map((c) => ({ source: c.source, heading: c.heading, chunkId: c.chunkId, score: c.rerankScore ?? c.score ?? null })),
      },
      artifacts,
    });
  }

  /** Label, level, owner and version of each artifact (no LLM), then the bytes to object storage. */
  private async storeArtifacts(
    conversationId: string, userMessageId: string, assistantMessageId: string, artifacts: RecordedArtifact[],
    snapshot: ConversationSnapshot | null, turn: number | null,
  ): Promise<StoredRow[]> {
    const versions = new Map<string, { parentArtifactId?: string; version: number }>();
    const systemOf = (a: RecordedArtifact) => a.systemName ?? systemNameOf({ dataJson: a.dataJson });
    for (const a of artifacts) {
      if (!VERSIONED_KINDS.has(a.kind)) continue;
      const system = systemOf(a);
      const chain = a.version !== undefined ? { parentArtifactId: a.parentArtifactId, version: a.version } : inferVersion(snapshot?.artifacts ?? [], a.kind, system);
      versions.set(system ?? '', chain);
    }
    const stored = await Promise.all(artifacts.map(async (artifact) => {
      const id = randomUUID();
      const messageId = artifact.owner === MessageRole.USER ? userMessageId : assistantMessageId;
      const system = systemOf(artifact);
      const levels = artifact.level ? [artifact.level] : levelsOf({ kind: artifact.kind, dataJson: artifact.dataJson, level: null });
      const chain = VERSIONED_KINDS.has(artifact.kind) || artifact.kind === ArtifactKind.C4_PNG || artifact.kind === ArtifactKind.C4_PUML
        ? versions.get(system ?? '') ?? { version: artifact.version ?? 1 }
        : { version: 1 };
      const row: NewArtifact = {
        id, messageId, kind: artifact.kind, caption: artifact.caption, ocrText: artifact.ocrText, dataJson: artifact.dataJson, mime: artifact.mime,
        label: artifact.label ?? artifactLabel({ kind: artifact.kind, systemName: system, levels, version: chain.version, turn }),
        ...(levels.length ? { level: levels.join(LEVELS_JOINER) } : {}),
        owner: artifact.owner,
        version: chain.version,
        ...(VERSIONED_KINDS.has(artifact.kind) && chain.parentArtifactId ? { parentArtifactId: chain.parentArtifactId } : {}),
      };
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
    return stored.filter((s): s is StoredRow => s !== null);
  }

  /** Captions for new images, design-note extraction, then auto-compaction — the DB is still awake from the turn's write. */
  private async afterTurn(input: TurnRecordInput, stored: StoredRow[], user: NewMessage, assistant: NewMessage, turn: number | null): Promise<void> {
    const toDescribe = stored
      .filter((s) => s.source.image && !s.row.caption && !s.row.ocrText)
      .map((s) => ({ id: s.row.id, image: s.source.image! }));
    const notes: DesignNoteJob[] = stored
      .filter((s) => s.source.designSource)
      .map((s) => ({ id: s.row.id, ...s.source.designSource!, version: s.row.version ?? 1, turn }));
    const [described, designed] = await Promise.all([
      attempt(() => this.jobs.enrichArtifacts(toDescribe)),
      attempt(() => this.jobs.enrichDesignNotes(notes)),
    ]);
    if (!described.ok) logger.warn(`[context] caption job failed: ${errorMessage(described.error)}`);
    if (!designed.ok) logger.warn(`[context] design note job failed: ${errorMessage(designed.error)}`);

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
        label: s.row.label ?? null, level: s.row.level ?? null, owner: s.row.owner ?? null, parentArtifactId: s.row.parentArtifactId ?? null, version: s.row.version ?? 1,
      })),
    ];
    const compacted = await attempt(() => this.jobs.compactIfNeeded(input.conversationId, snapshot?.summary ?? null, snapshot?.summaryUptoSeq ?? 0, messages, artifacts));
    if (!compacted.ok) logger.warn(`[context] compaction job failed: ${errorMessage(compacted.error)}`);
  }

  /** Bytes of image artifacts from object storage (missing ones are skipped). */
  async loadImages(artifacts: StoredArtifact[]): Promise<PromptImage[]> {
    const images = await Promise.all(artifacts.map(async (a): Promise<PromptImage | null> => {
      const bytes = a.objectKey ? await this.conversations.fetchArtifactBytes(a.objectKey) : null;
      return bytes ? { data: bytes, mimeType: a.mime ?? 'image/png', ...(typeof a.ordinal === 'number' ? { alias: artifactAlias(a) } : {}) } : null;
    }));
    return images.filter((i): i is PromptImage => i !== null);
  }

  /** History with the hot-window images loaded into their turns (ordinal order); other turns are untouched. */
  private async withHotWindow(history: ConversationTurn[], slots: HotWindowSlot[]): Promise<ConversationTurn[]> {
    if (slots.length === 0) return history;
    const loaded = await Promise.all(slots.map(async (slot) => ({ slot, images: await this.loadImages(slot.artifacts) })));
    const turns = [...history];
    for (const { slot, images } of loaded) {
      if (images.length > 0 && turns[slot.turnIndex]) turns[slot.turnIndex] = { ...turns[slot.turnIndex], images };
    }
    return turns;
  }

  private runInBackground(job: () => Promise<void>): void {
    const run = job().catch((err) => logger.warn(`[context] background job failed: ${errorMessage(err)}`));
    this.background.add(run);
    void run.finally(() => this.background.delete(run));
  }
}
