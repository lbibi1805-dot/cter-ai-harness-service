import { AnswerMode, type AgentRunResult, type AnswerResult } from '../../domain';

export function toAgentAnswer(run: AgentRunResult): AnswerResult {
  return {
    text: run.text,
    model: run.model,
    attempts: run.modelCalls,
    contexts: run.contexts,
    mode: AnswerMode.AGENT,
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
