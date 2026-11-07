import type OpenAI from 'openai';
import { retryTransient, withTimeout } from '../../../../shared/resilience';
import { assertCompletion } from '../../../ai';
import type { TextDeltaListener } from '../../../ai/domain/interfaces/aiProvider.port';
import { AGENT_TRANSPORT_ATTEMPTS, ModelTurnKind, type AgentToolDefinition, type ModelTurn, type ToolCallingSession, type ToolOutput, type TurnOptions } from '../../domain';
import { toolChoiceFor } from '../helpers/openaiResponsesToolModel.helper';
import { ChatCompletionsToolModelOptions } from '../interfaces/chatCompletionsToolModel.interface';
import { FUNCTION_TOOL } from '../constants/chatCompletionsToolModel.constants';
import { functionCalls } from '../helpers/chatCompletionsToolModel.helper';

/** Tool calls arrive in pieces (`index` + partial arguments), so they are rebuilt across chunks. */
interface StreamedToolCall {
  id: string;
  name: string;
  arguments: string;
}

interface StreamedTurn {
  content: string;
  calls: StreamedToolCall[];
  model: string;
  usage: { inputTokens: number; outputTokens: number };
}

export class ChatCompletionsSession implements ToolCallingSession {
  private readonly tools: OpenAI.ChatCompletionTool[];

  constructor(
    private readonly client: OpenAI,
    private readonly model: string,
    private readonly options: ChatCompletionsToolModelOptions,
    private readonly messages: OpenAI.ChatCompletionMessageParam[],
    tools: AgentToolDefinition[],
  ) {
    this.tools = tools.map((tool) => ({
      type: FUNCTION_TOOL,
      function: { name: tool.name, description: tool.description, parameters: tool.parameters },
    }));
  }

  async next(toolOutputs: ToolOutput[], options: TurnOptions, onDelta?: TextDeltaListener): Promise<ModelTurn> {
    for (const { callId, output } of toolOutputs) this.messages.push({ role: 'tool', tool_call_id: callId, content: output });

    const body: OpenAI.ChatCompletionCreateParamsNonStreaming = {
      model: this.model,
      messages: this.messages,
      tools: this.tools,
      tool_choice: toolChoiceFor(options),
      ...this.options.routing,
    };
    if (onDelta) return this.streamTurn(body, options, onDelta);

    const completion = await retryTransient(
      () => withTimeout(this.client.chat.completions.create(body), this.options.timeoutMs, `${this.options.label}/${this.model} (agent)`),
      { maxAttempts: AGENT_TRANSPORT_ATTEMPTS, sleep: this.options.sleep },
    );
    const message = assertCompletion(completion, this.model).message;
    const calls = functionCalls(message);
    this.messages.push(calls.length > 0
      ? { role: 'assistant', content: message.content ?? null, tool_calls: message.tool_calls }
      : { role: 'assistant', content: message.content ?? '' });

    const usage = { inputTokens: completion.usage?.prompt_tokens ?? 0, outputTokens: completion.usage?.completion_tokens ?? 0 };
    if (options.allowTools && calls.length > 0) return { kind: ModelTurnKind.TOOL_CALLS, calls, usage };
    return { kind: ModelTurnKind.FINAL, text: message.content ?? '', usage, model: completion.model || this.model };
  }

  /**
   * Same turn, streamed: text deltas go to `onDelta` as they arrive, the transcript keeps the finished turn.
   * No retry — a retried stream would resend text the client already saw.
   */
  private async streamTurn(
    body: OpenAI.ChatCompletionCreateParamsNonStreaming,
    options: TurnOptions,
    onDelta: TextDeltaListener,
  ): Promise<ModelTurn> {
    const turn = await withTimeout(
      this.collect(body, onDelta),
      this.options.timeoutMs,
      `${this.options.label}/${this.model} (agent)`,
    );
    const calls = turn.calls.filter((call) => call.name);
    this.messages.push(calls.length > 0
      ? {
          role: 'assistant',
          content: turn.content || null,
          tool_calls: calls.map((call) => ({
            id: call.id,
            type: FUNCTION_TOOL,
            function: { name: call.name, arguments: call.arguments },
          })),
        }
      : { role: 'assistant', content: turn.content });

    if (options.allowTools && calls.length > 0) {
      return { kind: ModelTurnKind.TOOL_CALLS, calls: calls.map((call) => ({ id: call.id, name: call.name, arguments: call.arguments })), usage: turn.usage };
    }
    return { kind: ModelTurnKind.FINAL, text: turn.content, usage: turn.usage, model: turn.model };
  }

  private async collect(body: OpenAI.ChatCompletionCreateParamsNonStreaming, onDelta: TextDeltaListener): Promise<StreamedTurn> {
    const stream = await this.client.chat.completions.create({ ...body, stream: true });
    const turn: StreamedTurn = { content: '', calls: [], model: this.model, usage: { inputTokens: 0, outputTokens: 0 } };
    const partials = new Map<number, StreamedToolCall>();
    for await (const chunk of stream) {
      if (chunk.model) turn.model = chunk.model;
      if (chunk.usage) turn.usage = { inputTokens: chunk.usage.prompt_tokens, outputTokens: chunk.usage.completion_tokens };
      const choice = chunk.choices?.[0];
      if (!choice) continue;
      if (choice.delta?.content) {
        turn.content += choice.delta.content;
        onDelta(choice.delta.content);
      }
      for (const piece of choice.delta?.tool_calls ?? []) {
        const call = partials.get(piece.index) ?? { id: '', name: '', arguments: '' };
        if (piece.id) call.id = piece.id;
        if (piece.function?.name) call.name += piece.function.name;
        if (piece.function?.arguments) call.arguments += piece.function.arguments;
        partials.set(piece.index, call);
      }
    }
    turn.calls = [...partials.entries()].sort(([a], [b]) => a - b).map(([, call]) => call);
    return turn;
  }
}
