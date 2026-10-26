import { errorMessage } from '../../../shared/errors';
import { logger } from '../../../shared/logging/logger';
import { attempt, attemptSync } from '../../../shared/resilience/attempt';
import {
  AgentStopReason,
  BUDGET_EXHAUSTED_NOTE,
  InvalidToolArgumentsError,
  ModelTurnKind,
  ToolRequestAfterBudgetError,
  UnknownToolError,
  ZERO_USAGE,
  addUsage,
  truncateToolOutput,
  type AgentBudget,
  type AgentRunResult,
  type AgentTool,
  type ToolCall,
  type ToolOutput,
  type ToolResult,
} from '../domain';
import { Attempt } from '../../../shared/resilience/interfaces/attempt.interface';
import { AgentRunRequest, RunProgress, ExecutedTool } from './interfaces/agentRunner.interface';
import { parseArguments } from './helpers/agentRunner.helper';

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
    const progress: RunProgress = { steps: [], sourcesRead: [], contexts: [] };
    let usage = ZERO_USAGE;
    let modelCalls = 0;
    let pendingOutputs: ToolOutput[] = [];

    for (;;) {
      const exhausted = this.exhaustedReason(progress.steps.length, startedAt);
      const turn = await session.next(pendingOutputs, {
        allowTools: exhausted === null,
        requireTool: exhausted === null && progress.steps.length < this.budget.minToolCalls,
      });
      modelCalls++;
      usage = addUsage(usage, turn.usage);

      if (turn.kind === ModelTurnKind.FINAL) {
        const result: AgentRunResult = {
          text: turn.text,
          model: turn.model ?? request.model.model,
          stopReason: exhausted ?? AgentStopReason.FINAL_ANSWER,
          ...progress,
          usage,
          modelCalls,
          durationMs: this.now() - startedAt,
        };
        this.logRun(request.label, result);
        return result;
      }
      if (exhausted !== null) throw new ToolRequestAfterBudgetError(exhausted);

      pendingOutputs = await this.runToolCalls(turn.calls, progress, startedAt);
    }
  }

  private async runToolCalls(calls: ToolCall[], progress: RunProgress, startedAt: number): Promise<ToolOutput[]> {
    const outputs: ToolOutput[] = [];
    for (const call of calls) {
      if (this.exhaustedReason(progress.steps.length, startedAt) !== null) {
        outputs.push({ callId: call.id, output: BUDGET_EXHAUSTED_NOTE });
        continue;
      }
      const executed = await this.execute(call, progress.steps.length + 1);
      progress.steps.push(executed.step);
      progress.contexts.push(...executed.contexts);
      for (const source of executed.step.sources) {
        if (!progress.sourcesRead.includes(source)) progress.sourcesRead.push(source);
      }
      outputs.push({ callId: call.id, output: executed.output });
    }
    return outputs;
  }

  private exhaustedReason(toolCalls: number, startedAt: number): AgentStopReason | null {
    if (toolCalls >= this.budget.maxToolCalls) return AgentStopReason.STEP_LIMIT;
    if (this.now() - startedAt >= this.budget.maxDurationMs) return AgentStopReason.TIME_LIMIT;
    return null;
  }

  /** A failing tool becomes a "Tool error: …" output so the model can correct itself. */
  private async execute(call: ToolCall, index: number): Promise<ExecutedTool> {
    const started = this.now();
    const parsedArgs = attemptSync(() => parseArguments(call.arguments));
    const args = parsedArgs.ok ? parsedArgs.value : {};
    const result = await attempt(() => this.invokeTool(call.name, parsedArgs));
    const durationMs = this.now() - started;

    if (!result.ok) {
      const message = errorMessage(result.error);
      return {
        output: `Tool error: ${message}`,
        step: { index, tool: call.name, args, sources: [], resultChars: 0, durationMs, error: message },
        contexts: [],
      };
    }
    const output = truncateToolOutput(result.value.content, this.budget.maxToolResultChars);
    return {
      output,
      step: { index, tool: call.name, args, sources: result.value.sources, resultChars: output.length, durationMs },
      contexts: result.value.contexts ?? [],
    };
  }

  private invokeTool(name: string, parsedArgs: Attempt<Record<string, unknown>>): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) throw new UnknownToolError(name, [...this.tools.keys()]);
    if (!parsedArgs.ok) throw new InvalidToolArgumentsError(`invalid tool arguments JSON: ${errorMessage(parsedArgs.error)}`);
    return tool.execute(parsedArgs.value);
  }

  private logRun(label: string, result: AgentRunResult): void {
    const sources = result.sourcesRead.join(', ') || 'none';
    logger.info(`[agent] ${label} — ${result.stopReason}, ${result.steps.length} tool call(s), ${result.modelCalls} model call(s), sources: ${sources}, tokens in/out ${result.usage.inputTokens}/${result.usage.outputTokens}`);
  }
}
