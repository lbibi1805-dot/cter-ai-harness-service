import { type OpenRouterRoutingFields } from '../../../ai';
import { ToolModelTimeouts } from './openaiResponsesToolModel.interface';

export interface ChatCompletionsToolModelOptions extends ToolModelTimeouts {
  /** OpenRouter server-side fallback (`models`) and host routing (`provider`). */
  routing?: OpenRouterRoutingFields;
  /** Shown in timeout messages, e.g. `openrouter`. */
  label: string;
}
