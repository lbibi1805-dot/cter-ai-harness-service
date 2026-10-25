import type OpenAI from 'openai';
import { type ToolCall } from '../../domain';
import { FUNCTION_TOOL } from '../constants/chatCompletionsToolModel.constants';

export function functionCalls(message: OpenAI.ChatCompletionMessage): ToolCall[] {
  return (message.tool_calls ?? [])
    .filter((call): call is OpenAI.ChatCompletionMessageFunctionToolCall => call.type === FUNCTION_TOOL)
    .map((call) => ({ id: call.id, name: call.function.name, arguments: call.function.arguments }));
}
