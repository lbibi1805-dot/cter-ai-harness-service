import type { AIAdapter, FileContent } from '../../types';
import { withTimeout } from '../../utils/withTimeout';

/**
 * `executeAIInvocation` — a single call to one AI model (mục 2.2 / mục 6 Phase 2
 * step 2). Deliberately narrow in scope per FIX #2: this does NOT retry, does NOT
 * walk a model-fallback chain, and does NOT hold any state — it wraps exactly the
 * "call adapter.process(...) with a timeout" step that both `fileProcessor`
 * (`files/`) and `messageProcessor` (`conversations/`) perform once per attempt.
 * The model-chain × retry loop stays in each caller, unchanged, per the plan:
 * "files/fileProcessor.ts và conversations/messageProcessor.ts tự viết vòng lặp
 * `for model of chain → for attempt` như hiện tại, chỉ đổi phần gọi AI để dùng
 * executeAIInvocation".
 */
export interface ExecuteAIInvocationParams {
  adapter: AIAdapter;
  content: FileContent;
  systemPrompt: string;
  model: string;
  timeoutMs: number;
  /** Label used in the timeout error message, e.g. `${provider}/${model}`. */
  timeoutLabel: string;
}

export async function executeAIInvocation(params: ExecuteAIInvocationParams): Promise<string> {
  return withTimeout(
    params.adapter.process(params.content, params.systemPrompt, params.model),
    params.timeoutMs,
    params.timeoutLabel,
  );
}
