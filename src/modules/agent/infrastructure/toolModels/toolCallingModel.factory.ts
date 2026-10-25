import OpenAI from 'openai';
import { SDK_MAX_RETRIES } from '../../../../shared/resilience';
import {
  AIProvider,
  ModelRoute,
  OpenAIApiMode,
  OpenRouterModelDirectory,
  buildRoutingFields,
  getOpenAIApiMode,
  type AiConfig,
} from '../../../ai';
import { AgentFallbackReason, type ToolCallingModelFactory } from '../../domain';
import { ChatCompletionsToolModel } from './chatCompletionsToolModel.adapter';
import { OpenAIResponsesToolModel } from './openaiResponsesToolModel.adapter';
import { DirectToolModelOptions, OpenRouterToolModelOptions } from '../interfaces/toolCallingModel.interface';
import { unsupported } from '../helpers/toolCallingModel.helper';

/** Direct mode: only OpenAI models served by the Responses API can run the agent. */
export function createOpenAIToolModelFactory(options: DirectToolModelOptions): ToolCallingModelFactory {
  const client = new OpenAI({ apiKey: options.apiKey, baseURL: options.baseURL, maxRetries: SDK_MAX_RETRIES });
  return async (provider, model) => {
    if (provider !== AIProvider.OPENAI) return unsupported(AgentFallbackReason.UNSUPPORTED_PROVIDER);
    if (getOpenAIApiMode(provider, model) !== OpenAIApiMode.RESPONSES) return unsupported(AgentFallbackReason.UNSUPPORTED_MODEL);
    return { supported: true, model: new OpenAIResponsesToolModel(client, model, options) };
  };
}

/**
 * OpenRouter fallback for the agent: runs the provider's configured OpenRouter
 * model (never a client-chosen one) through Chat Completions tool calling, as
 * long as it advertises `tools` support. Fallback models travel along, filtered the same way.
 */
export function createOpenRouterToolModelFactory(options: OpenRouterToolModelOptions): ToolCallingModelFactory {
  const directory = options.directory ?? new OpenRouterModelDirectory(options.client);
  const { openRouter, timeoutMs } = options.config;
  return async (provider) => {
    const model = openRouter.models[provider];
    if (!(await directory.supportsTools(model))) return unsupported(AgentFallbackReason.UNSUPPORTED_MODEL);
    const toolFallbacks: string[] = [];
    for (const fallback of openRouter.fallbacks[provider]) {
      if (await directory.supportsTools(fallback)) toolFallbacks.push(fallback);
    }
    const routing = buildRoutingFields(model, toolFallbacks, openRouter);
    return { supported: true, model: new ChatCompletionsToolModel(options.client, model, { timeoutMs, sleep: options.sleep, routing, label: ModelRoute.OPENROUTER }) };
  };
}

/**
 * Direct first (OpenAI Responses models), then the OpenRouter fallback for every
 * other provider/model. Null when neither route has credentials.
 */
export function createToolCallingModelFactory(config: AiConfig, openRouterClient: OpenAI | null): ToolCallingModelFactory | null {
  const apiKey = config.keys[AIProvider.OPENAI];
  const direct = apiKey ? createOpenAIToolModelFactory({ apiKey, timeoutMs: config.timeoutMs }) : null;
  const viaOpenRouter = openRouterClient ? createOpenRouterToolModelFactory({ client: openRouterClient, config }) : null;
  if (!direct && !viaOpenRouter) return null;
  return async (provider, model) => {
    const directResolution = direct ? await direct(provider, model) : null;
    if (directResolution?.supported || !viaOpenRouter) return directResolution ?? unsupported(AgentFallbackReason.UNSUPPORTED_PROVIDER);
    return viaOpenRouter(provider, model);
  };
}
