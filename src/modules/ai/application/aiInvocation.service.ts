import { errorMessage } from '../../../shared/errors';
import { logger } from '../../../shared/logging/logger';
import {
  DEFAULT_BACKOFF,
  FailureKind,
  attempt,
  sleep as realSleep,
  runWithFallback,
  withTimeout,
  type BackoffOptions,
  type FallbackFailure,
  type Sleep,
} from '../../../shared/resilience';
import { RATE_LIMIT_ATTEMPTS_PER_MODEL } from '../domain/constants/ai.constants';
import { ModelRoute } from '../domain/enums/ai.enums';
import { ProgressStage } from '../domain/enums/streamProgress.enums';
import { AIInvocationError } from '../domain/errors/ai.errors';
import type { AIAdapter, AIAdapterFactory } from '../domain/interfaces/aiProvider.port';
import type { ModelCatalog } from '../domain/modelCatalog';
import type { PromptPreparer } from './promptPreparer.service';
import { PreparedPrompt } from './interfaces/promptPreparer.interface';
import { AIInvocationDeps, AIInvocationSettings, AIRequest, AIAnswer, RouteResult } from './interfaces/aiInvocation.interface';
import { OPENROUTER_LOG_PREFIX } from './constants/aiInvocation.constants';
import { createStreamRelay } from './helpers/answerStream.helper';
import type { StreamRelay } from './interfaces/answerStream.interface';

/**
 * Single entry point for single-shot AI calls from every flow. The prompt is
 * prepared once. The direct chain (vendor API, primary model then fallbacks)
 * runs first with retries; when it is exhausted, or the provider has no direct
 * key, the backend falls back to OpenRouter. Callers never pick the route.
 */
export class AIInvocationService {
  private readonly sleep: Sleep;
  private readonly backoff: BackoffOptions;

  constructor(
    private readonly settings: AIInvocationSettings,
    private readonly catalog: ModelCatalog,
    private readonly prompts: PromptPreparer,
    private readonly adapters: AIAdapterFactory,
    deps: AIInvocationDeps = {},
  ) {
    this.sleep = deps.sleep ?? realSleep;
    this.backoff = deps.backoff ?? DEFAULT_BACKOFF;
  }

  async answer(request: AIRequest): Promise<AIAnswer> {
    return this.answerPrepared(request, await this.prompts.prepare(request.content));
  }

  /**
   * Same routes, retries and fallback as `answer`, for a caller that builds its own system prompt and
   * context (e.g. the C4 sketcher, which must not get the chat persona or per-call retrieval).
   */
  async answerPrepared(request: AIRequest, prompt: PreparedPrompt): Promise<AIAnswer> {
    const direct = this.adapters.direct(request.provider);
    const fallbackModel = this.catalog.openRouterFallback(request.provider);
    const openRouter = fallbackModel ? this.adapters.openRouter(request.provider) : null;
    if (!direct && !openRouter) {
      throw new AIInvocationError(`${this.adapters.credentialName(request.provider)} not configured`, FailureKind.FATAL, 0, request.model);
    }

    const relay = request.stream ? createStreamRelay(request.stream) : undefined;
    // The prompt is ready and a model call starts: a streamed client can stop saying "preparing".
    request.stream?.progress?.({ stage: ProgressStage.ANSWERING });
    let attemptsBefore = 0;
    if (direct) {
      const directRun = await attempt(() => this.runRoute(direct, this.catalog.chainFor(request.provider, request.model), request, prompt, relay));
      if (directRun.ok) return this.toAnswer(directRun.value, 0, prompt, ModelRoute.DIRECT);
      if (!openRouter || !fallbackModel) throw directRun.error;
      attemptsBefore = directRun.error instanceof AIInvocationError ? directRun.error.attempts : 0;
      const lastModel = directRun.error instanceof AIInvocationError ? directRun.error.lastModel : request.model;
      logger.fallback(request.provider, lastModel, `${OPENROUTER_LOG_PREFIX}${fallbackModel}`, request.label, errorMessage(directRun.error));
    }

    const routed = await attempt(() => this.runRoute(openRouter!, [fallbackModel!], request, prompt, relay));
    if (routed.ok) return this.toAnswer(routed.value, attemptsBefore, prompt, ModelRoute.OPENROUTER);
    throw this.withPriorAttempts(routed.error, attemptsBefore);
  }

  /** One route: each model is retried with backoff; rate limits and permanent errors move on; fatal stops the route. */
  private async runRoute(adapter: AIAdapter, models: string[], request: AIRequest, prompt: PreparedPrompt, relay?: StreamRelay): Promise<RouteResult> {
    const success = await runWithFallback(
      models,
      (model) => {
        relay?.beforeAttempt();
        return withTimeout(adapter.process(prompt.content, prompt.systemPrompt, model, relay?.onDelta), this.settings.timeoutMs, `${request.provider}/${model}`);
      },
      {
        attemptsPerTarget: (kind) => this.attemptLimit(kind),
        sleep: this.sleep,
        backoff: this.backoff,
        onAttempt: (model) => logger.ai(request.provider, model, request.label),
        onRetry: (_model, attemptOnModel, err, kind, delayMs) =>
          logger.retry(attemptOnModel, this.attemptLimit(kind), request.label, `${kind}, retry in ${delayMs}ms: ${errorMessage(err)}`),
        onFallback: (from, to, err, kind) => logger.fallback(request.provider, from, to, request.label, `${kind}: ${errorMessage(err)}`),
      },
      (failure: FallbackFailure) => new AIInvocationError(errorMessage(failure.error), failure.kind, failure.attempts, failure.target),
    );
    return { reply: success.value, attempts: success.attempts };
  }

  private toAnswer(result: RouteResult, attemptsBefore: number, prompt: PreparedPrompt, route: ModelRoute): AIAnswer {
    return {
      text: this.prompts.cleanResponse(result.reply.text),
      model: result.reply.model,
      attempts: attemptsBefore + result.attempts,
      contexts: prompt.contexts,
      route,
    };
  }

  /** The final error reports every attempt made, direct ones included. */
  private withPriorAttempts(error: unknown, attemptsBefore: number): unknown {
    if (!(error instanceof AIInvocationError) || attemptsBefore === 0) return error;
    return new AIInvocationError(error.message, error.kind, attemptsBefore + error.attempts, error.lastModel);
  }

  private attemptLimit(kind: FailureKind): number {
    const perModel = this.settings.maxRetryCount + 1;
    return kind === FailureKind.RATE_LIMITED ? Math.min(RATE_LIMIT_ATTEMPTS_PER_MODEL, perModel) : perModel;
  }
}
