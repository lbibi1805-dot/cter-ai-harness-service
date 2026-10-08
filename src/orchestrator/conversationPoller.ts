// Conversation poller (extension chat) — additive sibling of the file-based Q/A
// flow in `pollOrchestrator.ts`. Polls the active Canvas conversation for
// [CFH:REQUEST] messages without a matching [CFH:REPLY] and answers them with
// text-only markdown replies. Never touches Materials/Q/A logic.
import { ConversationClient } from '../canvas/conversationClient';
import { StateManager } from '../state/stateManager';
import type {
  AIProviderName,
  AppConfig,
  CanvasAccountConfig,
  ConversationMessage,
  FileContent,
} from '../types';
import { resolveModel } from '../ai/aiRouter';
import { ALLOWED_MODELS, isValidModel } from '../config/allowedModels';
import { AIInvocationService, PromptPreparer, type RagRefs, type RagRefsProvider } from '../modules/ai';
import { KEEP_CURSOR, PollJobName, type PollJob, type PollJobResult } from '../modules/polling/domain';
import {
  SETTINGS_CONVERSATION_MARKER,
  buildReply,
  isRequestMessage,
  parseReplyMessage,
  parseRequest,
} from '../utils/conversationMessageParser';
import { logger } from '../utils/logger';

/** Max REQUEST messages answered per account per poll round (bounds latency). */
export const MAX_CONV_PER_ROUND = 5;

/**
 * The settings conversation is rediscovered at most this often. Discovery pages
 * through every sent conversation (8+ requests per account), so doing it on
 * every tick made each tick slower than the poll interval.
 */
export const SETTINGS_CACHE_TTL_MS = 10 * 60 * 1000;

export type { RagRefs };
/** Getter for RAG instances — read on every message, never snapshotted. */
export type RagProvider = RagRefsProvider;

interface CachedSettings {
  conversationId: number;
  expiresAt: number;
}

export interface PendingConversationRequest {
  message: ConversationMessage;
  provider: string;
  model?: string;
  question: string;
  valid: boolean;
  invalidReason?: string;
}

export function buildConvStateKey(accountIndex: number, conversationId: number, messageId: number): string {
  return `conv-${accountIndex}-${conversationId}-${messageId}`;
}

/**
 * Matches REQUEST messages with REPLY messages, mirroring
 * `deriveRequestStatuses` in `extension/lib/messageFormat.js`: a REPLY with
 * `request_id` answers that REQUEST; a REPLY without id answers the oldest
 * unanswered REQUEST (legacy FIFO). Returns pending requests oldest-first.
 */
export function findPendingRequests(messages: ConversationMessage[]): PendingConversationRequest[] {
  const sorted = [...messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  const answered = new Set<string>();
  const legacyQueue: string[] = [];

  for (const msg of sorted) {
    if (isRequestMessage(msg.body)) {
      legacyQueue.push(String(msg.id));
      continue;
    }
    const reply = parseReplyMessage(msg.body);
    if (!reply) continue;
    if (reply.requestId !== null) {
      answered.add(String(reply.requestId));
      const qi = legacyQueue.indexOf(String(reply.requestId));
      if (qi !== -1) legacyQueue.splice(qi, 1);
    } else {
      const oldest = legacyQueue.shift();
      if (oldest !== undefined) answered.add(oldest);
    }
  }

  const pending: PendingConversationRequest[] = [];
  for (const msg of sorted) {
    if (!isRequestMessage(msg.body) || answered.has(String(msg.id))) continue;
    const parsed = parseRequest(msg.body);
    pending.push({
      message: msg,
      provider: parsed.provider,
      model: parsed.model,
      question: parsed.question,
      valid: parsed.valid,
      invalidReason: parsed.error,
    });
  }
  return pending;
}

export class ConversationPoller implements PollJob {
  readonly name = PollJobName.CONVERSATION;
  private readonly ai: AIInvocationService;
  private readonly settingsCache = new Map<number, CachedSettings>();

  constructor(
    private config: AppConfig,
    private state: StateManager,
    ragProvider?: RagProvider,
    private clientFactory: (account: CanvasAccountConfig) => ConversationClient = (a) =>
      new ConversationClient(a.url, a.apiKey),
    ai?: AIInvocationService,
    private now: () => number = Date.now,
  ) {
    this.ai = ai ?? new AIInvocationService(config, new PromptPreparer(config.systemPrompt, config.knowledgeContent, ragProvider));
  }

  /** Conversations are matched REQUEST↔REPLY in full every time, so no cursor is needed. */
  async run(account: CanvasAccountConfig): Promise<PollJobResult> {
    await this.pollAccountConversations(account);
    return KEEP_CURSOR;
  }

  async pollAccountConversations(account: CanvasAccountConfig): Promise<void> {
    const started = Date.now();
    const client = this.clientFactory(account);

    const settingsConversationId = await this.findSettingsConversation(account, client);
    if (settingsConversationId === null) return;

    let activeConversationId: number | null;
    try {
      const read = await client.readSettings(settingsConversationId);
      if (read.sawSystemPrompt) {
        logger.info('[conv] system_prompt setting present — ignored (phase 1), using config.systemPrompt');
      }
      activeConversationId = read.activeConversationId;
    } catch (err) {
      this.settingsCache.delete(account.index);
      logger.info(`[conv] account #${account.index} read settings failed: ${(err as Error).message}`);
      return;
    }
    if (!activeConversationId) {
      logger.info(`[conv] account #${account.index} no active_conversation_id set — skipping`);
      return;
    }

    let messages: ConversationMessage[];
    try {
      messages = await client.listMessages(activeConversationId);
    } catch (err) {
      logger.info(`[conv] account #${account.index} list messages failed: ${(err as Error).message}`);
      return;
    }

    const pending = findPendingRequests(messages).slice(0, MAX_CONV_PER_ROUND);
    if (pending.length === 0) {
      logger.info(`[conv] account #${account.index} conv ${activeConversationId} — no pending requests`);
      return;
    }

    let answered = 0;
    for (const req of pending) {
      const ok = await this.processOne(req, activeConversationId, account, client);
      if (ok) answered++;
    }
    logger.info(`[conv] account #${account.index} conv ${activeConversationId} — answered ${answered}/${pending.length} in ${Date.now() - started}ms`);
  }

  private async findSettingsConversation(account: CanvasAccountConfig, client: ConversationClient): Promise<number | null> {
    const cached = this.settingsCache.get(account.index);
    if (cached && cached.expiresAt > this.now()) return cached.conversationId;

    let settingsMatches: { id: number; subject: string }[];
    try {
      settingsMatches = await client.listSettingsConversations(SETTINGS_CONVERSATION_MARKER);
    } catch (err) {
      logger.info(`[conv] account #${account.index} settings discovery failed: ${(err as Error).message}`);
      return null;
    }
    if (settingsMatches.length === 0) {
      this.settingsCache.delete(account.index);
      logger.info(`[conv] account #${account.index} no settings conversation — skipping`);
      return null;
    }
    const conversationId = settingsMatches[0].id;
    this.settingsCache.set(account.index, { conversationId, expiresAt: this.now() + SETTINGS_CACHE_TTL_MS });
    return conversationId;
  }

  /**
   * Returns true when the message reached a terminal state (replied, or marked
   * failed after an invalid-format reply). Returns false on transient failure —
   * the record stays `processing` so `resetStaleProcessing` retries it later
   * instead of `isProcessed` skipping it forever as `failed` would.
   */
  private async processOne(
    req: PendingConversationRequest,
    conversationId: number,
    account: CanvasAccountConfig,
    client: ConversationClient,
  ): Promise<boolean> {
    const msg = req.message;
    // fileName = state key (stable). Never store question/body: StateManager drops
    // the record as "renamed" when fileName differs, which would duplicate replies.
    const key = buildConvStateKey(account.index, conversationId, msg.id);
    if (this.state.isProcessed(key, key)) {
      logger.info(`[conv] skip ${key} (in-state)`);
      return false;
    }
    this.state.setStatus({
      fileId: key,
      fileName: key,
      accountIndex: account.index,
      status: 'processing',
      retryCount: 0,
      updatedAt: new Date().toISOString(),
    });

    try {
      await this.processOneInner(req, conversationId, account, client, key);
      return true;
    } catch (err) {
      logger.info(`[conv] ${key} transient failure, will retry next round: ${(err as Error).message}`);
      return false;
    }
  }

  private async processOneInner(
    req: PendingConversationRequest,
    conversationId: number,
    account: CanvasAccountConfig,
    client: ConversationClient,
    key: string,
  ): Promise<void> {
    const msg = req.message;

    // Terminal validation failures: reply with an error, mark failed.
    if (!req.valid) {
      await client.addReply(conversationId, buildReply({
        requestId: msg.id,
        status: 'invalid-format',
        provider: req.provider || 'unknown',
        model: req.model ?? '',
        content: `**ERROR:** ${req.invalidReason ?? 'Invalid request format.'}`,
      }));
      this.markFailed(key, account, req.invalidReason ?? 'invalid request');
      return;
    }

    const provider = req.provider as AIProviderName;
    const primaryModel = resolveModel(provider, req.model, this.config.defaultModels);
    if (req.model !== undefined && !isValidModel(provider, primaryModel)) {
      await client.addReply(conversationId, buildReply({
        requestId: msg.id,
        status: 'invalid-format',
        provider,
        model: primaryModel,
        content: `**ERROR:** Model \`${primaryModel}\` is not supported for provider **${provider}**. Allowed: ${ALLOWED_MODELS[provider].join(', ')}`,
      }));
      this.markFailed(key, account, `Invalid model: ${primaryModel}`);
      logger.info(`[conv] ${key} invalid model ${provider}/${primaryModel}`);
      return;
    }

    // Attachments: images feed the vision-capable adapters, anything else
    // becomes a text note. A single failed download never fails the message.
    const imageBuffers: FileContent['imageBuffers'] = [];
    const notes: string[] = [];
    for (const att of msg.attachments) {
      try {
        const data = await client.downloadAttachment(att.url);
        if ((att.contentType ?? '').startsWith('image/')) {
          imageBuffers.push({ data, mimeType: att.contentType ?? 'image/png' });
        } else {
          notes.push(`[attachment: ${att.filename}]`);
        }
      } catch (err) {
        notes.push(`[attachment ${att.filename} unavailable: ${(err as Error).message}]`);
      }
    }
    const question = [req.question, ...notes].filter(Boolean).join('\n');
    const content: FileContent = { textContent: question, imageBuffers };

    // AI failures and reply-post failures both throw: the record stays
    // `processing`, so a later round retries it after the stale reset.
    const answer = await this.ai.answer({ provider, model: primaryModel, content, label: key });
    await client.addReply(conversationId, buildReply({
      requestId: msg.id,
      status: 'done',
      provider,
      model: answer.model,
      content: answer.text,
    }));
    this.state.setStatus({
      fileId: key,
      fileName: key,
      accountIndex: account.index,
      status: 'done',
      retryCount: answer.attempts - 1,
      updatedAt: new Date().toISOString(),
    });
    logger.info(`[conv] ${key} answered with ${provider}/${answer.model}`);
  }

  private markFailed(key: string, account: CanvasAccountConfig, error: string): void {
    this.state.setStatus({
      fileId: key,
      fileName: key,
      accountIndex: account.index,
      status: 'failed',
      retryCount: 0,
      updatedAt: new Date().toISOString(),
      error,
    });
  }
}
