import type { ModelRoute } from '../../domain/enums/ai.enums';
import type { ProviderUsage } from '../../domain/interfaces/aiProvider.port';
import type { AnswerTimings } from '../../domain/interfaces/answerTimings.interface';
import type { LatencyEntry } from '../../domain/interfaces/latencyRecorder.interface';
import type { AIRequest, InvocationRun } from '../interfaces/aiInvocation.interface';
import { LATENCY_LOG_TAG } from '../constants/aiInvocation.constants';

export function buildTimings(run: InvocationRun, now: number, usage: ProviderUsage | undefined): AnswerTimings {
  const firstDeltaAt = run.relay?.firstDeltaAt();
  return {
    ...(firstDeltaAt !== undefined ? { ttftMs: firstDeltaAt - run.startedAt } : {}),
    totalMs: now - run.startedAt,
    attempts: [...run.attempts],
    ...(usage?.inputTokens !== undefined ? { inputTokens: usage.inputTokens } : {}),
    ...(usage?.outputTokens !== undefined ? { outputTokens: usage.outputTokens } : {}),
    ...(usage?.cachedTokens !== undefined ? { cachedTokens: usage.cachedTokens } : {}),
    ...(run.retrievalMs !== undefined ? { retrievalMs: run.retrievalMs } : {}),
  };
}

export function latencyEntry(
  run: InvocationRun,
  now: number,
  result: { model: string; route?: ModelRoute; usage?: ProviderUsage; errorKind?: string },
): LatencyEntry {
  const firstDeltaAt = run.relay?.firstDeltaAt();
  return {
    at: now,
    provider: run.request.provider,
    model: result.model,
    route: result.route,
    kind: run.kind,
    ttftMs: firstDeltaAt !== undefined ? firstDeltaAt - run.startedAt : undefined,
    totalMs: now - run.startedAt,
    attempts: run.calls,
    errorKind: result.errorKind,
    inputTokens: result.usage?.inputTokens,
    cachedTokens: result.usage?.cachedTokens,
    outputTokens: result.usage?.outputTokens,
  };
}

/** One log line per answered invocation: `[latency] label provider/model route ttft total attempts tokens`. */
export function latencyLogLine(request: AIRequest, model: string, route: ModelRoute, timings: AnswerTimings): string {
  const ttft = timings.ttftMs !== undefined ? `ttft ${timings.ttftMs}ms, ` : '';
  const retrieval = timings.retrievalMs !== undefined ? `, retrieval ${timings.retrievalMs}ms` : '';
  const tokens = `tokens in/cached/out ${timings.inputTokens ?? '?'}/${timings.cachedTokens ?? '?'}/${timings.outputTokens ?? '?'}`;
  return `${LATENCY_LOG_TAG} ${request.label} — ${request.provider}/${model} (${route}) ${ttft}total ${timings.totalMs}ms${retrieval}, ${timings.attempts.length} attempt(s), ${tokens}`;
}
