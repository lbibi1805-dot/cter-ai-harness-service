import type OpenAI from 'openai';
import { retryTransient, withTimeout } from '../../../../shared/resilience';
import { assertCompletion } from '../../../ai';
import { AGENT_TRANSPORT_ATTEMPTS, ModelTurnKind, type AgentToolDefinition, type ModelTurn, type ToolCallingSession, type ToolOutput, type TurnOptions } from '../../domain';
import { toolChoiceFor } from '../helpers/openaiResponsesToolModel.helper';
import { ChatCompletionsToolModelOptions } from '../interfaces/chatCompletionsToolModel.interface';
import { FUNCTION_TOOL } from '../constants/chatCompletionsToolModel.constants';
import { functionCalls } from '../helpers/chatCompletionsToolModel.helper';

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

  async next(toolOutputs: ToolOutput[], options: TurnOptions): Promise<ModelTurn> {
    for (const { callId, output } of toolOutputs) this.messages.push({ role: 'tool', tool_call_id: callId, content: output });

    const body: OpenAI.ChatCompletionCreateParamsNonStreaming = {
      model: this.model,
      messages: this.messages,
      tools: this.tools,
      tool_choice: toolChoiceFor(options),
      ...this.options.routing,
    };
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
}
