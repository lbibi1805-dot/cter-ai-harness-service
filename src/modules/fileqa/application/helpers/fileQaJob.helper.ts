import { AnswerMode, type AnswerResult } from '../../../agent/domain';
import { type CanvasFile } from '../../domain';

/** Extra PDF header lines for agent requests (nothing for plain single-shot answers). */
export function describeAnswer(answer: AnswerResult): Record<string, string> {
  if (answer.mode === AnswerMode.AGENT && answer.agent) {
    return {
      Mode: `agent (${answer.agent.toolCalls} tool calls, ${answer.agent.stopReason})`,
      'Sources read': answer.agent.sourcesRead.join(', ') || 'none',
    };
  }
  if (answer.fallbackReason) return { Mode: `single-shot (agent unavailable: ${answer.fallbackReason})` };
  return {};
}

export function byUpdatedAtAsc(a: CanvasFile, b: CanvasFile): number {
  return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
}
