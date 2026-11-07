import { ServiceDisabledError, UpstreamError, errorMessage } from '../../../shared/errors';
import { logger } from '../../../shared/logging/logger';
import { attempt } from '../../../shared/resilience/attempt';
import type { Answerer } from '../../agent/domain';
import { UnsupportedModelError, perProvider, type AnswerStream, type ModelCatalog } from '../../ai';
import { ChatServiceOptions, ChatStatus, ChatQuestion, ChatAnswer } from './interfaces/chat.interface';

/**
 * Direct chat for clients that talk to the backend over HTTP instead of a
 * Canvas conversation. Same answer pipeline (RAG, model fallback, agent mode)
 * as the conversation poller; nothing is written to Canvas or the state file.
 */
export class ChatService {
  private sequence = 0;

  constructor(
    private readonly answers: Answerer,
    private readonly catalog: ModelCatalog,
    private readonly options: ChatServiceOptions,
  ) {}

  status(): ChatStatus {
    this.ensureEnabled();
    return {
      agentEnabled: this.options.agentEnabled,
      conversations: !!this.options.turns,
      providers: perProvider(this.options.isProviderConfigured),
      defaultModels: perProvider((provider) => this.catalog.defaultModel(provider)),
      models: perProvider((provider) => this.catalog.allowedModels(provider)),
    };
  }

  /** Same model rules as a Canvas [CFH:REQUEST]; any AI failure becomes an UpstreamError (HTTP 502). */
  /** With `stream`, single-shot answers are reported chunk by chunk (agent mode still answers at the end). */
  /**
   * With the conversation store: 1 DB read before (context), 1 DB transaction after (the turn);
   * a store failure never fails the answer.
   */
  async ask(question: ChatQuestion, stream?: AnswerStream): Promise<ChatAnswer> {
    this.ensureEnabled();
    const { provider, requestedModel, mode } = question;
    const model = this.catalog.resolve(provider, requestedModel);
    if (requestedModel !== undefined && !this.catalog.isAllowed(provider, model)) {
      throw new UnsupportedModelError(provider, model, this.catalog.allowedModels(provider));
    }

    const label = `chat-api-${Date.now()}-${++this.sequence}`;
    const started = Date.now();
    const turn = this.options.turns
      ? await this.options.turns.begin({
          conversationId: question.conversationId,
          question: question.content.textContent,
          images: question.content.imageBuffers,
          clientHistory: question.content.history ?? [],
        })
      : null;
    const content = turn?.content ?? question.content;

    let ttftMs: number | undefined;
    const timedStream: AnswerStream | undefined = stream && {
      ...stream,
      delta: (text) => {
        ttftMs ??= Date.now() - started;
        stream.delta(text);
      },
    };
    const answer = await attempt(() => this.answers.answer({ provider, model, content, label, mode, stream: timedStream }));
    if (!answer.ok) {
      logger.warn(`[chat-api] ${label} failed for ${provider}/${model}: ${errorMessage(answer.error)}`);
      throw new UpstreamError(`AI request failed: ${errorMessage(answer.error)}`, undefined, { cause: answer.error });
    }
    const durationMs = Date.now() - started;
    logger.info(`[chat-api] ${label} answered with ${provider}/${answer.value.model} (${answer.value.mode ?? mode}) in ${durationMs}ms${ttftMs !== undefined ? `, ttft ${ttftMs}ms` : ''}`);

    const conversation = turn
      ? await turn.finish({
          text: answer.value.text,
          provider,
          model: answer.value.model,
          mode: answer.value.mode ?? mode,
          durationMs,
          ttftMs,
          sources: answer.value.contexts ?? [],
        })
      : undefined;
    return { question, model, answer: answer.value, durationMs, ...(conversation ? { conversation } : {}) };
  }

  /** The API spends AI credits, so without CHAT_API_TOKEN it fails closed (HTTP 503) before reading the request. */
  ensureEnabled(): void {
    if (!this.options.enabled) throw new ServiceDisabledError('Chat API disabled: set CHAT_API_TOKEN on the server');
  }
}
