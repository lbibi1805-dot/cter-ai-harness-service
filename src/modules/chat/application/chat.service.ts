import { ServiceDisabledError, UpstreamError, errorMessage } from '../../../shared/errors';
import { logger } from '../../../shared/logging/logger';
import { attempt } from '../../../shared/resilience/attempt';
import { AnswerMode, type Answerer, type AnswerResult } from '../../agent/domain';
import { EssayRequestMode, EssayTrigger, detectEssayQuestion, type EssayDetails, type EssayRequestOptions } from '../../essay';
import { UnsupportedModelError, perProvider, type AnswerStream, type ModelCatalog } from '../../ai';
import { stripTrailingReferences } from '../../retrieval/application/citationPrompt.builder';
import { fencePlantUmlBlocks } from '../../../shared/text';
import { buildAnswerSources } from './helpers/chatSources.helper';
import { tokenUsage } from './helpers/chatTokens.helper';
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
    // Essay Mode is decided before the turn opens: its aux session then serves the artifact resolver AND the
    // essay analysis, so an essay costs at most one aux call before writing.
    const essayOptions = this.essayOptionsFor(question);
    const essayAux = essayOptions ? this.options.essayAux?.({ imageCount: question.content.imageBuffers.length }) ?? null : null;
    const turn = this.options.turns
      ? await this.options.turns.begin({
          conversationId: question.conversationId,
          question: question.content.textContent,
          images: question.content.imageBuffers,
          clientHistory: question.content.history ?? [],
          ...(question.refArtifactIds?.length ? { refArtifactIds: question.refArtifactIds } : {}),
          ...(essayAux ? { auxResolver: essayAux } : {}),
        })
      : null;
    const content = turn?.content ?? question.content;
    // Provider prompt-cache routing (OpenAI prompt_cache_key): one key per conversation.
    const cacheKey = turn?.conversationId ?? question.conversationId;

    let ttftMs: number | undefined;
    const timedStream: AnswerStream | undefined = stream && {
      ...stream,
      delta: (text) => {
        ttftMs ??= Date.now() - started;
        stream.delta(text);
      },
    };
    const essay = essayOptions ? this.options.essay! : null;
    // Essay Mode (15): its own pipeline instead of the answerer; agent mode is never combined with it.
    const answer = essay && essayOptions
      ? await attempt(() => essay.write({
        provider, model, content, label, options: essayOptions, stream: timedStream,
        ...(cacheKey ? { cacheKey } : {}),
        ...(essayAux ? { sharedAnalysis: essayAux } : {}),
      })
        .then((written): AnswerResult & { essay: EssayDetails } => ({ ...written, mode: AnswerMode.SINGLE_SHOT })))
      : await attempt((): Promise<AnswerResult & { essay?: EssayDetails }> => this.answers.answer({
        provider, model, content, label, mode, stream: timedStream,
        ...(cacheKey ? { cacheKey } : {}),
        ...(turn?.agentTools?.length ? { extraTools: turn.agentTools } : {}),
      }));
    if (!answer.ok) {
      logger.warn(`[chat-api] ${label} failed for ${provider}/${model}: ${errorMessage(answer.error)}`);
      throw new UpstreamError(`AI request failed: ${errorMessage(answer.error)}`, undefined, { cause: answer.error });
    }
    const durationMs = Date.now() - started;
    // The prompt no longer asks for `## References` (sources are listed by the client); drop one the model still wrote.
    const { essay: essayDetails, ...answered } = answer.value;
    // Bare `@startuml … @enduml` → ```plantuml fence (essay path too) so clients render it; idempotent.
    const result = { ...answered, text: fencePlantUmlBlocks(stripTrailingReferences(answered.text)) };
    const answeredMode = essayDetails ? EssayRequestMode.ESSAY : answer.value.mode ?? mode;
    const sources = buildAnswerSources(result);
    logger.info(`[chat-api] ${label} answered with ${provider}/${answer.value.model} (${answeredMode}) in ${durationMs}ms${ttftMs !== undefined ? `, ttft ${ttftMs}ms` : ''}`);

    const conversation = turn
      ? await turn.finish({
          text: result.text,
          provider,
          model: answer.value.model,
          mode: answeredMode,
          durationMs,
          ttftMs,
          sources: result.contexts ?? [],
          ...tokenUsage(result),
        })
      : undefined;
    return { question, model, answer: result, durationMs, sources, ...(conversation ? { conversation } : {}), ...(essayDetails ? { essay: essayDetails } : {}) };
  }

  /** Explicit `/essay` / `mode: "essay"`, or (ESSAY_MODE_ENABLED) the conservative detector; null without the essay pipeline. */
  private essayOptionsFor(question: ChatQuestion): EssayRequestOptions | null {
    const essay = this.options.essay;
    if (!essay) {
      if (question.essay) logger.info('[chat-api] essay requested but Essay Mode is unavailable (no retrieval) — answering normally');
      return null;
    }
    if (question.essay) return question.essay;
    return essay.autoDetect && detectEssayQuestion(question.content.textContent) ? { trigger: EssayTrigger.AUTO, strict: false } : null;
  }

  /** The API spends AI credits, so without CHAT_API_TOKEN it fails closed (HTTP 503) before reading the request. */
  ensureEnabled(): void {
    if (!this.options.enabled) throw new ServiceDisabledError('Chat API disabled: set CHAT_API_TOKEN on the server');
  }
}
