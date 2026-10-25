import type { CanvasAccountConfig } from '../../../shared/canvas/interfaces/canvasAccount.interface';
import { errorMessage } from '../../../shared/errors';
import { logger } from '../../../shared/logging/logger';
import { attempt } from '../../../shared/resilience/attempt';
import type { StateManager } from '../../../shared/state/processingStateStore';
import type { Answerer } from '../../agent/domain';
import type { AIProvider, ModelCatalog, PromptContent, PromptImage } from '../../ai';
import { KEEP_CURSOR, PollJobName, type PollJob, type PollJobResult } from '../../polling/domain';
import type { ConversationGateway } from '../domain/interfaces/canvasConversation.port';
import {
  DEFAULT_IMAGE_MIME,
  IMAGE_MIME_PREFIX,
  MAX_CONV_PER_ROUND,
  SETTINGS_CACHE_TTL_MS,
  SETTINGS_CONVERSATION_MARKER,
  UNKNOWN_PROVIDER,
} from '../domain/constants/conversation.constants';
import { ConversationReplyStatus } from '../domain/enums/conversation.enums';
import { buildReply } from '../domain/conversationMessage';
import { buildConvStateKey, findPendingRequests } from '../domain/pendingRequests';
import { ConversationMessage } from '../domain/interfaces/conversationMessage.interface';
import { CachedSettings, ConversationPollerDeps, RequestTask } from './interfaces/conversationPoller.interface';
import { ProcessingStatus } from '../../../shared/state/enums/processingRecord.enums';

/**
 * Extension chat: polls the active Canvas conversation for [CFH:REQUEST]
 * messages without a matching [CFH:REPLY] and answers each with a text reply.
 */
export class ConversationPoller implements PollJob {
  readonly name = PollJobName.CONVERSATION;
  private readonly settingsCache = new Map<number, CachedSettings>();
  private readonly now: () => number;

  constructor(
    private readonly catalog: ModelCatalog,
    private readonly state: StateManager,
    private readonly answers: Answerer,
    private readonly deps: ConversationPollerDeps,
  ) {
    this.now = deps.now ?? Date.now;
  }

  /** Conversations are matched REQUEST↔REPLY in full every time, so no cursor is needed. */
  async run(account: CanvasAccountConfig): Promise<PollJobResult> {
    await this.pollAccountConversations(account);
    return KEEP_CURSOR;
  }

  async pollAccountConversations(account: CanvasAccountConfig): Promise<void> {
    const started = Date.now();
    const client = this.deps.createClient(account);

    const settingsConversationId = await this.findSettingsConversation(account, client);
    if (settingsConversationId === null) return;
    const activeConversationId = await this.readActiveConversation(account, client, settingsConversationId);
    if (activeConversationId === null) return;

    const messages = await attempt(() => client.listMessages(activeConversationId));
    if (!messages.ok) {
      logger.warn(`[conv] account #${account.index} list messages failed: ${errorMessage(messages.error)}`);
      return;
    }
    const pending = findPendingRequests(messages.value).slice(0, MAX_CONV_PER_ROUND);
    if (pending.length === 0) {
      logger.info(`[conv] account #${account.index} conv ${activeConversationId} — no pending requests`);
      return;
    }

    let answered = 0;
    for (const request of pending) {
      const key = buildConvStateKey(account.index, activeConversationId, request.message.id);
      if (await this.processOne({ request, conversationId: activeConversationId, account, client, key })) answered++;
    }
    logger.info(`[conv] account #${account.index} conv ${activeConversationId} — answered ${answered}/${pending.length} in ${Date.now() - started}ms`);
  }

  private async findSettingsConversation(account: CanvasAccountConfig, client: ConversationGateway): Promise<number | null> {
    const cached = this.settingsCache.get(account.index);
    if (cached && cached.expiresAt > this.now()) return cached.conversationId;

    const matches = await attempt(() => client.listSettingsConversations(SETTINGS_CONVERSATION_MARKER));
    if (!matches.ok) {
      logger.warn(`[conv] account #${account.index} settings discovery failed: ${errorMessage(matches.error)}`);
      return null;
    }
    const [newest] = matches.value;
    if (!newest) {
      this.settingsCache.delete(account.index);
      logger.info(`[conv] account #${account.index} no settings conversation — skipping`);
      return null;
    }
    this.settingsCache.set(account.index, { conversationId: newest.id, expiresAt: this.now() + SETTINGS_CACHE_TTL_MS });
    return newest.id;
  }

  /** A failed read forgets the cached settings conversation (it may have been deleted). */
  private async readActiveConversation(account: CanvasAccountConfig, client: ConversationGateway, settingsConversationId: number): Promise<number | null> {
    const settings = await attempt(() => client.readSettings(settingsConversationId));
    if (!settings.ok) {
      this.settingsCache.delete(account.index);
      logger.warn(`[conv] account #${account.index} read settings failed: ${errorMessage(settings.error)}`);
      return null;
    }
    if (settings.value.sawSystemPrompt) logger.info('[conv] system_prompt setting present — ignored (phase 1), using config.systemPrompt');
    if (!settings.value.activeConversationId) {
      logger.info(`[conv] account #${account.index} no active_conversation_id set — skipping`);
      return null;
    }
    return settings.value.activeConversationId;
  }

  /**
   * True when the message reached a terminal state (replied, or marked failed
   * after an invalid-format reply). False on a transient failure: the record
   * stays PROCESSING so the stale reset retries it later.
   */
  private async processOne(task: RequestTask): Promise<boolean> {
    const { key, account } = task;
    if (this.state.isProcessed(key, key)) {
      logger.info(`[conv] skip ${key} (in-state)`);
      return false;
    }
    this.record(key, account, ProcessingStatus.PROCESSING, 0);

    const handled = await attempt(() => this.answerRequest(task));
    if (!handled.ok) logger.warn(`[conv] ${key} transient failure, will retry next round: ${errorMessage(handled.error)}`);
    return handled.ok;
  }

  private async answerRequest(task: RequestTask): Promise<void> {
    const { request, key } = task;
    if (!request.valid) {
      return this.rejectRequest(task, request.provider || UNKNOWN_PROVIDER, request.model ?? '', request.invalidReason ?? 'Invalid request format.');
    }

    const provider = request.provider as AIProvider;
    const model = this.catalog.resolve(provider, request.model);
    if (request.model !== undefined && !this.catalog.isAllowed(provider, model)) {
      const allowed = this.catalog.allowedModels(provider).join(', ');
      logger.info(`[conv] ${key} invalid model ${provider}/${model}`);
      return this.rejectRequest(task, provider, model, `Model \`${model}\` is not supported for provider **${provider}**. Allowed: ${allowed}`);
    }

    const content = await this.buildContent(request.message, request.question, task.client);
    // AI and reply-post failures throw: the record stays PROCESSING and is retried later.
    const answer = await this.answers.answer({ provider, model, content, label: key, mode: request.mode });
    await task.client.addReply(task.conversationId, buildReply({
      requestId: request.message.id,
      status: ConversationReplyStatus.DONE,
      provider,
      model: answer.model,
      content: answer.text,
      mode: answer.mode,
    }));
    this.record(key, task.account, ProcessingStatus.DONE, answer.attempts - 1);
    logger.info(`[conv] ${key} answered with ${provider}/${answer.model}`);
  }

  /** Terminal validation failure: reply with the error and mark the request failed. */
  private async rejectRequest(task: RequestTask, provider: string, model: string, reason: string): Promise<void> {
    await task.client.addReply(task.conversationId, buildReply({
      requestId: task.request.message.id,
      status: ConversationReplyStatus.INVALID_FORMAT,
      provider,
      model,
      content: `**ERROR:** ${reason}`,
    }));
    this.record(task.key, task.account, ProcessingStatus.FAILED, 0, reason);
  }

  /** Image attachments go to the model; other files become a text note. A failed download never fails the request. */
  private async buildContent(message: ConversationMessage, question: string, client: ConversationGateway): Promise<PromptContent> {
    const imageBuffers: PromptImage[] = [];
    const notes: string[] = [];
    for (const attachment of message.attachments) {
      const download = await attempt(() => client.downloadAttachment(attachment.url));
      if (!download.ok) {
        notes.push(`[attachment ${attachment.filename} unavailable: ${errorMessage(download.error)}]`);
        continue;
      }
      if ((attachment.contentType ?? '').startsWith(IMAGE_MIME_PREFIX)) {
        imageBuffers.push({ data: download.value, mimeType: attachment.contentType ?? DEFAULT_IMAGE_MIME });
      } else {
        notes.push(`[attachment: ${attachment.filename}]`);
      }
    }
    return { textContent: [question, ...notes].filter(Boolean).join('\n'), imageBuffers };
  }

  /** The state key doubles as the record's file name so a later "rename" check never drops it. */
  private record(key: string, account: CanvasAccountConfig, status: ProcessingStatus, retryCount: number, error?: string): void {
    this.state.setStatus({ fileId: key, fileName: key, accountIndex: account.index, status, retryCount, updatedAt: new Date().toISOString(), error });
  }
}
