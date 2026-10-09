import { errorMessage } from '../../../shared/resilience';
import type { FileContent } from '../../../types';
import { logger } from '../../../utils/logger';
import {
  AgentStopReason,
  ModelTurnKind,
  ZERO_USAGE,
  addUsage,
  truncateToolOutput,
  type AgentBudget,
  type AgentRunResult,
  type AgentStep,
  type AgentTool,
  type ToolCall,
  type ToolCallingModel,
  type ToolOutput,
} from '../domain';
import { BUDGET_EXHAUSTED_NOTE } from './agentPrompt';

export interface AgentRunRequest {
  model: ToolCallingModel;
  systemPrompt: string;
  content: FileContent;
  label: string;
}

/**
 * The agent loop: model → tool calls → tool outputs → model … until the model
 * answers or the budget (tool calls / wall clock) runs out, at which point one
 * last turn without tools forces an answer. Tool failures are reported to the
 * model as text; only model/transport failures throw (caller falls back).
 */
export class AgentRunner {
  private readonly tools: Map<string, AgentTool>;

  constructor(
    tools: AgentTool[],
    private readonly budget: AgentBudget,
    private readonly now: () => number = Date.now,
  ) {
    this.tools = new Map(tools.map((tool) => [tool.name, tool]));
  }

  async run(request: AgentRunRequest): Promise<AgentRunResult> {
    const startedAt = this.now();
    const definitions = [...this.tools.values()].map(({ name, description, parameters }) => ({ name, description, parameters }));
    const session = request.model.startSession(request.systemPrompt, request.content, definitions);
    const steps: AgentStep[] = [];
    const sourcesRead: string[] = [];
    let usage = ZERO_USAGE;
    let modelCalls = 0;
    let pendingOutputs: ToolOutput[] = [];

    for (;;) {
      const exhausted = this.exhaustedReason(steps.length, startedAt);
      const turn = await session.next(pendingOutputs, { allowTools: exhausted === null });
      modelCalls++;
      usage = addUsage(usage, turn.usage);

      if (turn.kind === ModelTurnKind.FINAL) {
        const result: AgentRunResult = {
          text: turn.text,
          model: request.model.model,
          stopReason: exhausted ?? AgentStopReason.FINAL_ANSWER,
          steps,
          sourcesRead,
          usage,
          modelCalls,
          durationMs: this.now() - startedAt,
        };
        logger.info(`[agent] ${request.label} — ${result.stopReason}, ${steps.length} tool call(s), ${modelCalls} model call(s), sources: ${sourcesRead.join(', ') || 'none'}, tokens in/out ${usage.inputTokens}/${usage.outputTokens}`);
        return result;
      }
      if (exhausted !== null) {
        throw new Error(`model requested tools after the budget was exhausted (${exhausted})`);
      }

      pendingOutputs = [];
      for (const call of turn.calls) {
        if (this.exhaustedReason(steps.length, startedAt) !== null) {
          pendingOutputs.push({ callId: call.id, output: BUDGET_EXHAUSTED_NOTE });
          continue;
        }
        const { output, step } = await this.execute(call, steps.length + 1);
        steps.push(step);
        for (const source of step.sources) if (!sourcesRead.includes(source)) sourcesRead.push(source);
        pendingOutputs.push({ callId: call.id, output });
      }
    }
  }

  private exhaustedReason(toolCalls: number, startedAt: number): AgentStopReason | null {
    if (toolCalls >= this.budget.maxToolCalls) return AgentStopReason.STEP_LIMIT;
    if (this.now() - startedAt >= this.budget.maxDurationMs) return AgentStopReason.TIME_LIMIT;
    return null;
  }

  private async execute(call: ToolCall, index: number): Promise<{ output: string; step: AgentStep }> {
    const started = this.now();
    const tool = this.tools.get(call.name);
    let args: Record<string, unknown> = {};
    try {
      if (!tool) throw new Error(`unknown tool "${call.name}". Available: ${[...this.tools.keys()].join(', ')}`);
      args = parseArguments(call.arguments);
      const result = await tool.execute(args);
      const output = truncateToolOutput(result.content, this.budget.maxToolResultChars);
      return {
        output,
        step: { index, tool: call.name, args, sources: result.sources, resultChars: output.length, durationMs: this.now() - started },
      };
    } catch (err) {
      const message = errorMessage(err);
      return {
        output: `Tool error: ${message}`,
        step: { index, tool: call.name, args, sources: [], resultChars: 0, durationMs: this.now() - started, error: message },
      };
    }
  }
}

function parseArguments(raw: string): Record<string, unknown> {
  if (!raw.trim()) return {};
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('tool arguments must be a JSON object');
  return parsed as Record<string, unknown>;
}
