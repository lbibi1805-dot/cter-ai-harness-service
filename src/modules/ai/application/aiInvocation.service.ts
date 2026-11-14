import { TimeoutError, errorMessage } from '../../../shared/errors';
import { logger } from '../../../shared/logging/logger';
import {
  DEFAULT_BACKOFF,
  FailureKind,
  attempt,
  backoffDelayMs,
  classifyFailure,
  extractHttpStatus,
  guardedCall,
  sleep as realSleep,
  type BackoffOptions,
  type Sleep,
} from '../../../shared/resilience';
import { RATE_LIMIT_ATTEMPTS_PER_MODEL } from '../domain/constants/ai.constants';
import { ModelRoute } from '../domain/enums/ai.enums';
import { AttemptDecision } from '../domain/enums/attemptPolicy.enums';
import { AttemptOutcome, InvocationErrorKind, InvocationKind } from '../domain/enums/latency.enums';
import { ProgressStage } from '../domain/enums/streamProgress.enums';
import { AIInvocationError } from '../domain/errors/ai.errors';
import { attemptOutcome, decideAfterFailure, isCircuitFailure } from '../domain/helpers/attemptPolicy.helper';
import { resolveLatencySettings } from '../domain/helpers/latency.helper';
import type { AIAdapterFactory, ProviderReply } from '../domain/interfaces/aiProvider.port';
import type { AiLatencySettings } from '../domain/interfaces/latency.interface';
import type { ModelCatalog } from '../domain/modelCatalog';
import type { PromptPreparer } from './promptPreparer.service';
import { PreparedPrompt } from './interfaces/promptPreparer.interface';
import {
  AIInvocationDeps,
  AIInvocationSettings,
  AIRequest,
  AIAnswer,
  InvocationRun,
  RouteFailure,
  RouteOutcome,
  RoutePlan,
} from './interfaces/aiInvocation.interface';
import { CIRCUIT_REASON_MAX_CHARS, OPENROUTER_LOG_PREFIX } from './constants/aiInvocation.constants';
import { createStreamRelay } from './helpers/answerStream.helper';
import { buildTimings, latencyEntry, latencyLogLine } from './helpers/invocationTimings.helper';
import { LatencyRecorder } from './latencyRecorder.service';
import { ModelCircuitBreaker } from './modelCircuit.service';

/**
 * Single entry point for single-shot AI calls from every flow. The prompt is
 * prepared once. The direct chain (vendor API, primary model then fallbacks)
 * runs first; when it is exhausted, or the provider has no direct key, the
 * backend falls back to OpenRouter. Callers never pick the route.
 *
 * Latency guards (07 §3.2): every attempt is aborted for real (first-token,
 * idle-between-chunks and per-attempt timeouts), the whole call has one
 * deadline, only 429/5xx are retried and only before any text was streamed,
 * and models that keep failing with 503/overloaded/timeouts are skipped for a
 * while (circuit breaker).
 */
export class AIInvocationService {
  /** Every invocation, in memory (for `/api/metrics/latency`). */
  readonly metrics: LatencyRecorder;
  /** Models currently skipped (for `/api/ai-usage`). */
  readonly circuit: ModelCircuitBreaker;
  private readonly sleep: Sleep;
  private readonly backoff: BackoffOptions;
  private readonly now: () => number;
  private readonly latency: AiLatencySettings;

  constructor(
    private readonly settings: AIInvocationSettings,
    private readonly catalog: ModelCatalog,
    private readonly prompts: PromptPreparer,
    private readonly adapters: AIAdapterFactory,
    deps: AIInvocationDeps = {},
  ) {
    this.sleep = deps.sleep ?? realSleep;
    this.backoff = deps.backoff ?? DEFAULT_BACKOFF;
    this.now = deps.now ?? Date.now;
    this.latency = resolveLatencySettings(settings.latency);
    this.metrics = deps.metrics ?? new LatencyRecorder(undefined, this.now);
    this.circuit = deps.circuit ?? new ModelCircuitBreaker(this.latency.circuit, this.now);
  }

  /** CHAT_DEADLINE_MS: callers that run something first (agent) give the fallback what is left of it. */
  get deadlineMs(): number {
    return this.latency.chatDeadlineMs;
  }

  async answer(request: AIRequest): Promise<AIAnswer> {
    const startedAt = this.now();
    const prompt = await this.prompts.prepare(request.content);
    const kind = request.stream ? InvocationKind.STREAM : InvocationKind.ANSWER;
    return this.invoke(request, prompt, startedAt, kind, this.now() - startedAt);
  }

  /**
   * Same routes, retries and fallback as `answer`, for a caller that builds its own system prompt and
   * context (e.g. the C4 sketcher, which must not get the chat persona or per-call retrieval).
   */
  async answerPrepared(request: AIRequest, prompt: PreparedPrompt): Promise<AIAnswer> {
    return this.invoke(request, prompt, this.now(), InvocationKind.PREPARED);
  }

  private async invoke(request: AIRequest, prompt: PreparedPrompt, startedAt: number, kind: InvocationKind, retrievalMs?: number): Promise<AIAnswer> {
    const run: InvocationRun = {
      request,
      startedAt,
      deadlineAt: request.deadlineAt ?? startedAt + this.latency.chatDeadlineMs,
      relay: request.stream ? createStreamRelay(request.stream, this.now) : undefined,
      attempts: [],
      calls: 0,
      retrievalMs,
      kind: request.purpose ?? kind,
    };
    const outcome = await attempt(() => this.runPlan(run, prompt));
    if (!outcome.ok) {
      const failure = outcome.error instanceof AIInvocationError ? outcome.error : undefined;
      this.metrics.record(latencyEntry(run, this.now(), { model: failure?.lastModel ?? request.model, errorKind: errorKindOf(outcome.error) }));
      throw outcome.error;
    }
    const { reply, route } = outcome.value;
    const timings = buildTimings(run, this.now(), reply.usage);
    this.metrics.record(latencyEntry(run, this.now(), { model: reply.model, route, usage: reply.usage }));
    logger.info(latencyLogLine(request, reply.model, route, timings));
    return {
      text: this.prompts.cleanResponse(reply.text),
      model: reply.model,
      attempts: run.calls,
      contexts: prompt.contexts,
      route,
      timings,
      ...(reply.finishReason ? { finishReason: reply.finishReason } : {}),
    };
  }

  private async runPlan(run: InvocationRun, prompt: PreparedPrompt): Promise<{ reply: ProviderReply; route: ModelRoute }> {
    const { request } = run;
    const plan = this.plan(run);
    // The prompt is ready and a model call starts: a streamed client can stop saying "preparing".
    request.stream?.progress?.({ stage: ProgressStage.ANSWERING });

    let last: RouteFailure | undefined;
    for (const [index, step] of plan.entries()) {
      if (last && step.route === ModelRoute.OPENROUTER) {
        logger.fallback(request.provider, last.model, `${OPENROUTER_LOG_PREFIX}${step.models[0]}`, request.label, errorMessage(last.error));
      }
      const outcome = await this.runRoute(run, step, prompt);
      if (outcome.ok) return { reply: outcome.reply, route: step.route };
      last = outcome.failure;
      // A fatal direct error (bad or unpaid key) still lets OpenRouter try; the deadline ends everything.
      const fatalOnLastRoute = last.kind === FailureKind.FATAL && index === plan.length - 1;
      if (last.final || fatalOnLastRoute) break;
    }
    throw this.toError(run, last);
  }

  /** Routes in order, without the models whose circuit is open (unless that would leave nothing to try). */
  private plan(run: InvocationRun): RoutePlan[] {
    const { request } = run;
    const direct = this.adapters.direct(request.provider);
    const fallbackModel = this.catalog.openRouterFallback(request.provider);
    const openRouter = fallbackModel ? this.adapters.openRouter(request.provider) : null;
    if (!direct && !openRouter) {
      throw new AIInvocationError(`${this.adapters.credentialName(request.provider)} not configured`, FailureKind.FATAL, 0, request.model);
    }
    const full: RoutePlan[] = [];
    if (direct) full.push({ route: ModelRoute.DIRECT, adapter: direct, models: this.catalog.chainFor(request.provider, request.model) });
    if (openRouter && fallbackModel) full.push({ route: ModelRoute.OPENROUTER, adapter: openRouter, models: [fallbackModel] });

    const available = full
      .map((step) => ({ ...step, models: step.models.filter((model) => !this.circuit.isOpen(step.route, model)) }))
      .filter((step) => step.models.length > 0);
    if (available.length === 0) return full;
    for (const step of full) {
      for (const model of step.models) {
        if (this.circuit.isOpen(step.route, model)) run.attempts.push({ model, outcome: AttemptOutcome.CIRCUIT_OPEN, ms: 0 });
      }
    }
    return available;
  }

  /** One route: each model is tried in order; see `decideAfterFailure` for retries and model switches. */
  private async runRoute(run: InvocationRun, step: RoutePlan, prompt: PreparedPrompt): Promise<RouteOutcome> {
    const { request } = run;
    let last: RouteFailure | undefined;
    for (const [index, model] of step.models.entries()) {
      for (let attemptOnModel = 1; ; attemptOnModel++) {
        const stop = this.stopReason(run, model, last);
        if (stop) return { ok: false, failure: stop };

        run.calls++;
        logger.ai(request.provider, model, request.label);
        const sink = run.relay?.beginAttempt();
        const startedAt = this.now();
        const result = await attempt(() => guardedCall(
          ({ signal, touch }) => step.adapter.process(
            prompt.content,
            prompt.systemPrompt,
            model,
            sink ? (text) => { touch(); sink.onDelta(text); } : undefined,
            { signal, cacheKey: request.cacheKey, ...(request.maxOutputTokens ? { maxOutputTokens: request.maxOutputTokens } : {}), ...(request.thinkingLevel ? { thinkingLevel: request.thinkingLevel } : {}) },
          ),
          this.attemptLimits(run, `${request.provider}/${model}`),
        ));
        sink?.close();

        if (result.ok) {
          this.circuit.recordSuccess(step.route, model);
          run.attempts.push({ model, outcome: AttemptOutcome.OK, ms: this.now() - startedAt });
          return { ok: true, reply: result.value };
        }

        const error = result.error;
        const kind = classifyFailure(error);
        const timedOut = error instanceof TimeoutError;
        run.attempts.push({ model, outcome: attemptOutcome(kind, timedOut), ms: this.now() - startedAt });
        if (isCircuitFailure(error) && this.circuit.recordFailure(step.route, model, errorMessage(error).slice(0, CIRCUIT_REASON_MAX_CHARS))) {
          logger.warn(`[circuit] ${step.route}/${model} skipped for ${this.latency.circuit.cooldownMs}ms after repeated failures: ${errorMessage(error)}`);
        }
        last = { error, kind, model, final: false };
        const limit = this.attemptLimit(kind);
        const decision = decideAfterFailure({
          kind,
          status: extractHttpStatus(error),
          timedOut,
          emittedText: sink?.emitted() ?? false,
          circuitOpen: this.circuit.isOpen(step.route, model),
          attemptOnModel,
          limit,
        });
        if (decision === AttemptDecision.STOP) return { ok: false, failure: last };
        if (decision === AttemptDecision.NEXT_MODEL) {
          const next = step.models[index + 1];
          if (next) logger.fallback(request.provider, model, next, request.label, `${kind}: ${errorMessage(error)}`);
          break;
        }
        const delayMs = Math.min(backoffDelayMs(attemptOnModel - 1, this.backoff), Math.max(0, run.deadlineAt - this.now()));
        logger.retry(attemptOnModel, limit, request.label, `${kind}, retry in ${delayMs}ms: ${errorMessage(error)}`);
        await this.sleep(delayMs);
      }
    }
    return { ok: false, failure: last ?? { error: new AIInvocationError('no model to try', FailureKind.PERMANENT, 0, request.model), kind: FailureKind.PERMANENT, model: request.model, final: false } };
  }

  /** The deadline or a caller abort ends the call before the next attempt. */
  private stopReason(run: InvocationRun, model: string, last: RouteFailure | undefined): RouteFailure | null {
    if (run.request.signal?.aborted) {
      return { error: run.request.signal.reason ?? last?.error, kind: FailureKind.PERMANENT, model: last?.model ?? model, final: true };
    }
    if (this.now() < run.deadlineAt) return null;
    const waited = this.now() - run.startedAt;
    const reason = last ? `; last error: ${errorMessage(last.error)}` : '';
    return {
      error: new TimeoutError(`Deadline of ${run.deadlineAt - run.startedAt}ms exceeded after ${waited}ms (${run.request.label})${reason}`),
      kind: FailureKind.TRANSIENT,
      model: last?.model ?? model,
      final: true,
      errorKind: InvocationErrorKind.DEADLINE,
    };
  }

  /** Streamed: first-token + idle timeouts within the deadline. Polled: AI_TIMEOUT_MS per attempt, within the deadline. */
  private attemptLimits(run: InvocationRun, label: string) {
    const remaining = run.deadlineAt - this.now();
    const parent = run.request.signal;
    if (!run.relay) return { totalMs: Math.min(this.settings.timeoutMs, remaining), label, parent };
    return {
      totalMs: remaining,
      firstTokenMs: Math.min(this.latency.firstTokenTimeoutMs, remaining),
      idleMs: this.latency.idleTimeoutMs,
      label,
      parent,
    };
  }

  private toError(run: InvocationRun, last: RouteFailure | undefined): AIInvocationError {
    const failure = last ?? { error: new Error('no route'), kind: FailureKind.PERMANENT, model: run.request.model };
    return new AIInvocationError(errorMessage(failure.error), failure.kind, run.calls, failure.model, last?.errorKind ?? failure.kind);
  }

  private attemptLimit(kind: FailureKind): number {
    const perModel = this.settings.maxRetryCount + 1;
    return kind === FailureKind.RATE_LIMITED ? Math.min(RATE_LIMIT_ATTEMPTS_PER_MODEL, perModel) : perModel;
  }
}

function errorKindOf(error: unknown): string {
  return error instanceof AIInvocationError ? error.errorKind : classifyFailure(error);
}
