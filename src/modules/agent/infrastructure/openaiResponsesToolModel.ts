import OpenAI from 'openai';
import type { ResponseInputItem, ResponseOutputItem } from 'openai/resources/responses/responses';
import { SDK_MAX_RETRIES } from '../../../ai/sdkOptions';
import { getModelApiMode } from '../../../config/allowedModels';
import { retryTransient, type Sleep } from '../../../shared/resilience';
import type { FileContent } from '../../../types';
import { withTimeout } from '../../../utils/withTimeout';
import {
  ModelTurnKind,
  ToolChoice,
  type AgentToolDefinition,
  type ModelTurn,
  type ToolCallingModel,
  type ToolCallingModelFactory,
  type ToolCallingSession,
  type ToolOutput,
  type TurnOptions,
} from '../domain';

const OPENAI_PROVIDER = 'openai';
const TRANSPORT_ATTEMPTS = 3;

export interface OpenAIToolModelOptions {
  apiKey: string;
  timeoutMs: number;
  /** Test hook: point the SDK at a fake OpenAI-compatible server. */
  baseURL?: string;
  sleep?: Sleep;
}

/** Tool calling via the OpenAI Responses API (models whose API mode is `responses`). */
export function createOpenAIToolModelFactory(options: OpenAIToolModelOptions): ToolCallingModelFactory {
  const client = new OpenAI({ apiKey: options.apiKey, baseURL: options.baseURL, maxRetries: SDK_MAX_RETRIES });
  return (provider, model) => {
    if (provider !== OPENAI_PROVIDER || getModelApiMode(OPENAI_PROVIDER, model) !== 'responses') return null;
    return new OpenAIResponsesToolModel(client, model, options);
  };
}

export class OpenAIResponsesToolModel implements ToolCallingModel {
  constructor(
    private readonly client: OpenAI,
    readonly model: string,
    private readonly options: Pick<OpenAIToolModelOptions, 'timeoutMs' | 'sleep'>,
  ) {}

  startSession(systemPrompt: string, content: FileContent, tools: AgentToolDefinition[]): ToolCallingSession {
    return new OpenAIResponsesSession(this.client, this.model, this.options, systemPrompt, content, tools);
  }
}

class OpenAIResponsesSession implements ToolCallingSession {
  /** Full transcript resent each turn (stateless; no server-side conversation needed). */
  private readonly input: ResponseInputItem[];
  private readonly tools: OpenAI.Responses.FunctionTool[];

  constructor(
    private readonly client: OpenAI,
    private readonly model: string,
    private readonly options: Pick<OpenAIToolModelOptions, 'timeoutMs' | 'sleep'>,
    systemPrompt: string,
    content: FileContent,
    tools: AgentToolDefinition[],
  ) {
    this.input = [
      { role: 'system', content: [{ type: 'input_text', text: systemPrompt }] },
      {
        role: 'user',
        content: [
          ...(content.textContent ? [{ type: 'input_text' as const, text: content.textContent }] : []),
          ...content.imageBuffers.map((img) => ({
            type: 'input_image' as const,
            image_url: `data:${img.mimeType};base64,${img.data.toString('base64')}`,
            detail: 'auto' as const,
          })),
        ],
      },
    ];
    this.tools = tools.map((t) => ({ type: 'function', name: t.name, description: t.description, parameters: t.parameters, strict: false }));
  }

  async next(toolOutputs: ToolOutput[], { allowTools, requireTool = false }: TurnOptions): Promise<ModelTurn> {
    for (const { callId, output } of toolOutputs) {
      this.input.push({ type: 'function_call_output', call_id: callId, output });
    }
    const toolChoice = !allowTools ? ToolChoice.NONE : requireTool ? ToolChoice.REQUIRED : ToolChoice.AUTO;

    const response = await retryTransient(
      () => withTimeout(
        this.client.responses.create({ model: this.model, input: this.input, tools: this.tools, tool_choice: toolChoice }),
        this.options.timeoutMs,
        `openai/${this.model} (agent)`,
      ),
      { maxAttempts: TRANSPORT_ATTEMPTS, sleep: this.options.sleep },
    );

    this.input.push(...(response.output as ResponseOutputItem[] as ResponseInputItem[]));
    const usage = { inputTokens: response.usage?.input_tokens ?? 0, outputTokens: response.usage?.output_tokens ?? 0 };
    const calls = response.output
      .filter((item): item is OpenAI.Responses.ResponseFunctionToolCall => item.type === 'function_call')
      .map((item) => ({ id: item.call_id, name: item.name, arguments: item.arguments }));

    if (allowTools && calls.length > 0) return { kind: ModelTurnKind.TOOL_CALLS, calls, usage };
    return { kind: ModelTurnKind.FINAL, text: response.output_text ?? '', usage };
  }
}
