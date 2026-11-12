import { errorMessage } from '../../../shared/errors';
import { logger } from '../../../shared/logging/logger';
import { attempt, attemptSync } from '../../../shared/resilience/attempt';
import {
  AgentStopReason,
  BUDGET_EXHAUSTED_NOTE,
  InvalidToolArgumentsError,
  ModelTurnKind,
  TOOL_REFERENCE_CLOSE,
  TOOL_REFERENCE_OPEN,
  ToolBudgetGroup,
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
import { ProgressStage } from '../../ai/domain/enums/streamProgress.enums';
import { AgentRunRequest, RunProgress, ExecutedTool } from './interfaces/agentRunner.interface';
import { parseArguments } from './helpers/agentRunner.helper';

function groupOf(tools: Map<string, AgentTool>, name: string): ToolBudgetGroup {
  return tools.get(name)?.budgetGroup ?? ToolBudgetGroup.RESEARCH;
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
    const tools = this.toolsFor(request);
    const definitions = [...tools.values()].map(({ name, description, parameters }) => ({ name, description, parameters }));
    const session = request.model.startSession(request.systemPrompt, request.content, definitions);
    const progress: RunProgress = { steps: [], sourcesRead: [], contexts: [] };
    let usage = ZERO_USAGE;
    let modelCalls = 0;
    let pendingOutputs: ToolOutput[] = [];

    for (;;) {
      const research = this.researchCalls(progress, tools);
      const exhausted = this.exhaustedReason(research, startedAt);
      let streamedText = false;
      const onDelta = request.stream
        ? (text: string) => {
            if (!text) return;
            streamedText = true;
            request.stream!.delta(text);
          }
        : undefined;
      // Every turn is a model call: tell a streamed client that the tools are done and the answer is being written.
      request.stream?.progress?.({ stage: ProgressStage.ANSWERING });
      const turn = await session.next(pendingOutputs, {
        allowTools: exhausted === null,
        requireTool: exhausted === null && research < this.budget.minToolCalls,
      }, onDelta);
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
      // A tool-call turn that talked first: drop the preamble, the tools' output is not part of the answer.
      if (streamedText) request.stream?.reset();
      if (exhausted !== null) throw new ToolRequestAfterBudgetError(exhausted);

      pendingOutputs = await this.runToolCalls(turn.calls, progress, startedAt, request, tools);
    }
  }

  /**
   * Runs one turn's tool calls concurrently (every tool is read-only, so independent `search_vault` calls no
   * longer wait for each other, 07 §3.5). Calls beyond their budget (research: AGENT_MAX_TOOL_CALLS, diagram:
   * AGENT_MAX_DIAGRAM_VALIDATIONS) get the "budget exhausted" note. Steps, sources and outputs keep the order
   * the model asked for.
   */
  private async runToolCalls(calls: ToolCall[], progress: RunProgress, startedAt: number, request: AgentRunRequest, tools: Map<string, AgentTool>): Promise<ToolOutput[]> {
    const research = this.researchCalls(progress, tools);
    const outOfTime = this.exhaustedReason(research, startedAt) !== null;
    const left: Record<ToolBudgetGroup, number> = {
      [ToolBudgetGroup.RESEARCH]: outOfTime ? 0 : Math.max(0, this.budget.maxToolCalls - research),
      [ToolBudgetGroup.DIAGRAM]: outOfTime ? 0 : Math.max(0, (this.budget.maxDiagramValidations ?? 0) - (progress.steps.length - research)),
    };
    let index = progress.steps.length;
    const runs = calls.map((call) => {
      const group = groupOf(tools, call.name);
      if (left[group] <= 0) return null;
      left[group]--;
      request.stream?.progress?.({ stage: ProgressStage.AGENT_TOOL, detail: call.name });
      return this.execute(call, ++index, tools);
    });
    const executed = await Promise.all(runs);

    return calls.map((call, position) => {
      const result = executed[position];
      if (!result) return { callId: call.id, output: BUDGET_EXHAUSTED_NOTE };
      progress.steps.push(result.step);
      progress.contexts.push(...result.contexts);
      for (const source of result.step.sources) {
        if (!progress.sourcesRead.includes(source)) progress.sourcesRead.push(source);
      }
      return { callId: call.id, output: result.output };
    });
  }

  /** AGENT_MAX_DURATION_MS: the answer service gives a failed run's single-shot fallback what is left of it. */
  get maxDurationMs(): number {
    return this.budget.maxDurationMs;
  }

  /** Steps that count against AGENT_MAX_TOOL_CALLS (everything except diagram validations). */
  private researchCalls(progress: RunProgress, tools: Map<string, AgentTool>): number {
    return progress.steps.filter((step) => groupOf(tools, step.tool) === ToolBudgetGroup.RESEARCH).length;
  }

  private exhaustedReason(toolCalls: number, startedAt: number): AgentStopReason | null {
    if (toolCalls >= this.budget.maxToolCalls) return AgentStopReason.STEP_LIMIT;
    if (this.now() - startedAt >= this.budget.maxDurationMs) return AgentStopReason.TIME_LIMIT;
    return null;
  }

  /** A failing tool becomes a "Tool error: …" output so the model can correct itself. */
  private async execute(call: ToolCall, index: number, tools: Map<string, AgentTool>): Promise<ExecutedTool> {
    const started = this.now();
    const parsedArgs = attemptSync(() => parseArguments(call.arguments));
    const args = parsedArgs.ok ? parsedArgs.value : {};
    const result = await attempt(() => this.invokeTool(tools, call.name, parsedArgs));
    const durationMs = this.now() - started;

    if (!result.ok) {
      const message = errorMessage(result.error);
      return {
        output: `Tool error: ${message}`,
        step: { index, tool: call.name, args, sources: [], resultChars: 0, durationMs, error: message },
        contexts: [],
      };
    }
    const truncated = truncateToolOutput(result.value.content, this.budget.maxToolResultChars);
    const output = tools.get(call.name)?.referenceMaterial ? `${TOOL_REFERENCE_OPEN}\n${truncated}\n${TOOL_REFERENCE_CLOSE}` : truncated;
    return {
      output,
      step: { index, tool: call.name, args, sources: result.value.sources, resultChars: output.length, durationMs },
      contexts: result.value.contexts ?? [],
    };
  }

  /** Built-in tools plus the request's own (a per-request tool never replaces a built-in one). */
  private toolsFor(request: AgentRunRequest): Map<string, AgentTool> {
    if (!request.extraTools?.length) return this.tools;
    const tools = new Map(this.tools);
    for (const tool of request.extraTools) if (!tools.has(tool.name)) tools.set(tool.name, tool);
    return tools;
  }

  private invokeTool(tools: Map<string, AgentTool>, name: string, parsedArgs: Attempt<Record<string, unknown>>): Promise<ToolResult> {
    const tool = tools.get(name);
    if (!tool) throw new UnknownToolError(name, [...tools.keys()]);
    if (!parsedArgs.ok) throw new InvalidToolArgumentsError(`invalid tool arguments JSON: ${errorMessage(parsedArgs.error)}`);
    return tool.execute(parsedArgs.value);
  }

  private logRun(label: string, result: AgentRunResult): void {
    const sources = result.sourcesRead.join(', ') || 'none';
    logger.info(`[agent] ${label} — ${result.stopReason}, ${result.steps.length} tool call(s), ${result.modelCalls} model call(s), sources: ${sources}, tokens in/out ${result.usage.inputTokens}/${result.usage.outputTokens}`);
  }
}
