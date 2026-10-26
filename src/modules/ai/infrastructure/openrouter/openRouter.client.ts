import OpenAI from 'openai';
import { SDK_MAX_RETRIES } from '../../../../shared/resilience/constants/sdk.constants';
import { OPENROUTER_MAX_ROUTED_MODELS } from '../../domain/constants/ai.constants';
import { EmptyProviderResponseError } from '../../domain/errors/ai.errors';
import type { OpenRouterConfig } from '../../domain/interfaces/aiConfig.interface';
import { OpenRouterHeader } from '../enums/openRouter.enums';
import { OpenRouterRoutingFields, OpenRouterErrorBody } from '../interfaces/openRouter.interface';

export function createOpenRouterClient(config: OpenRouterConfig, overrides: { baseURL?: string } = {}): OpenAI {
  const defaultHeaders: Record<string, string> = {};
  if (config.appUrl) defaultHeaders[OpenRouterHeader.REFERER] = config.appUrl;
  if (config.appTitle) defaultHeaders[OpenRouterHeader.TITLE] = config.appTitle;
  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: overrides.baseURL ?? config.baseUrl,
    defaultHeaders,
    maxRetries: SDK_MAX_RETRIES,
  });
}

/**
 * Primary model plus its configured fallbacks, as OpenRouter's `models` array
 * (deduplicated, primary first, cut to OpenRouter's limit), and the output cap.
 */
export function buildRoutingFields(primary: string, fallbacks: readonly string[], config: OpenRouterConfig): OpenRouterRoutingFields {
  const models = [...new Set([primary, ...fallbacks])].slice(0, OPENROUTER_MAX_ROUTED_MODELS);
  return {
    ...(models.length > 1 ? { models } : {}),
    provider: { ...(config.providerSort ? { sort: config.providerSort } : {}), allow_fallbacks: config.allowProviderFallbacks },
    max_tokens: config.maxTokens,
  };
}

/**
 * Turns an in-body error (sent with HTTP 200) or a reply without choices into
 * an exception carrying the upstream status, so the failure classifier can
 * decide between retry, fallback and stop.
 */
export function assertCompletion(completion: OpenAI.ChatCompletion, requestedModel: string): OpenAI.ChatCompletion.Choice {
  const bodyError = (completion as unknown as OpenRouterErrorBody).error;
  if (bodyError) {
    throw new EmptyProviderResponseError(`OpenRouter ${requestedModel}: ${bodyError.code ?? ''} ${bodyError.message ?? 'error'}`.trim(), bodyError.code);
  }
  const choice = completion.choices?.[0];
  if (!choice) throw new EmptyProviderResponseError(`OpenRouter ${requestedModel} returned no choices`);
  return choice;
}
