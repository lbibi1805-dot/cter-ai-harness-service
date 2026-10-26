import type OpenAI from 'openai';
import type { ResponseInputItem, ResponseOutputItem } from 'openai/resources/responses/responses';
import { retryTransient, withTimeout } from '../../../../shared/resilience';
import { toDataUrl } from '../../../ai/domain/promptContent';
import { toResponsesHistory } from '../../../ai';
import { AGENT_TRANSPORT_ATTEMPTS, ModelTurnKind, type AgentToolDefinition, type ModelTurn, type ToolCallingSession, type ToolOutput, type TurnOptions } from '../../domain';
import { PromptContent } from '../../../ai/domain/interfaces/promptContent.interface';
import { ToolModelTimeouts } from '../interfaces/openaiResponsesToolModel.interface';
import { IMAGE_DETAIL, RESPONSES_FUNCTION_CALL } from '../constants/openaiResponsesToolModel.constants';
import { toolChoiceFor } from '../helpers/openaiResponsesToolModel.helper';

export class OpenAIResponsesSession implements ToolCallingSession {
  /** Full transcript resent each turn (stateless; no server-side conversation needed). */
  private readonly input: ResponseInputItem[];
  private readonly tools: OpenAI.Responses.FunctionTool[];

  constructor(
    private readonly client: OpenAI,
    private readonly model: string,
    private readonly options: ToolModelTimeouts,
    systemPrompt: string,
    content: PromptContent,
    tools: AgentToolDefinition[],
  ) {
    this.input = [
      { role: 'system', content: [{ type: 'input_text', text: systemPrompt }] },
      ...toResponsesHistory(content.history),
      {
        role: 'user',
        content: [
          ...(content.textContent ? [{ type: 'input_text' as const, text: content.textContent }] : []),
          ...content.imageBuffers.map((image) => ({ type: 'input_image' as const, image_url: toDataUrl(image), detail: IMAGE_DETAIL })),
        ],
      },
    ];
    this.tools = tools.map((tool) => ({ type: 'function', name: tool.name, description: tool.description, parameters: tool.parameters, strict: false }));
  }

  async next(toolOutputs: ToolOutput[], options: TurnOptions): Promise<ModelTurn> {
    for (const { callId, output } of toolOutputs) this.input.push({ type: 'function_call_output', call_id: callId, output });

    const response = await retryTransient(
      () => withTimeout(
        this.client.responses.create({ model: this.model, input: this.input, tools: this.tools, tool_choice: toolChoiceFor(options) }),
        this.options.timeoutMs,
        `openai/${this.model} (agent)`,
      ),
      { maxAttempts: AGENT_TRANSPORT_ATTEMPTS, sleep: this.options.sleep },
    );

    // Echo every output item (reasoning included) so the next turn sees the full transcript.
    this.input.push(...(response.output as ResponseOutputItem[] as ResponseInputItem[]));
    const usage = { inputTokens: response.usage?.input_tokens ?? 0, outputTokens: response.usage?.output_tokens ?? 0 };
    const calls = response.output
      .filter((item): item is OpenAI.Responses.ResponseFunctionToolCall => item.type === RESPONSES_FUNCTION_CALL)
      .map((item) => ({ id: item.call_id, name: item.name, arguments: item.arguments }));

    if (options.allowTools && calls.length > 0) return { kind: ModelTurnKind.TOOL_CALLS, calls, usage };
    return { kind: ModelTurnKind.FINAL, text: response.output_text ?? '', usage };
  }
}
