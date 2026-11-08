import { AttemptOutcome } from '../../../ai/domain/enums/latency.enums';
import { AnswerMode, type AgentRunResult, type AnswerResult } from '../../domain';

export function toAgentAnswer(run: AgentRunResult): AnswerResult {
  return {
    text: run.text,
    model: run.model,
    attempts: run.modelCalls,
    contexts: run.contexts,
    mode: AnswerMode.AGENT,
    // Best effort: the agent has no per-attempt timeline, so the whole run is one "attempt".
    timings: {
      totalMs: run.durationMs,
      attempts: [{ model: run.model, outcome: AttemptOutcome.OK, ms: run.durationMs }],
      inputTokens: run.usage.inputTokens,
      outputTokens: run.usage.outputTokens,
    },
    agent: {
      stopReason: run.stopReason,
      toolCalls: run.steps.length,
      sourcesRead: run.sourcesRead,
      usage: run.usage,
      steps: run.steps,
      modelCalls: run.modelCalls,
      durationMs: run.durationMs,
    },
  };
}
