import {
  DEFAULT_AI_TIMEOUT_MS,
  DEFAULT_DIRECT_FALLBACKS,
  DEFAULT_DIRECT_MODELS,
  DEFAULT_MAX_RETRY_COUNT,
  GROK_DEFAULT_BASE_URL,
  OPENROUTER_DEFAULT_BASE_URL,
  OPENROUTER_DEFAULT_MAX_TOKENS,
  OPENROUTER_DEFAULT_MODELS,
  OpenRouterProviderSort,
  perProvider,
  type AiConfig,
} from '../../../modules/ai';
import { readBoolean, readEnum, readInt, readList, readOptionalString, readString } from '../../../shared/config/env';
import { envSuffix } from '../../helpers/config.helper';

/** Direct keys/models/fallbacks per provider, plus the OpenRouter fallback route. */
export function readAiConfig(): AiConfig {
  return {
    keys: perProvider((provider) => readOptionalString(`${envSuffix(provider)}_API_KEY`)),
    defaultModels: perProvider((provider) => readString(`DEFAULT_MODEL_${envSuffix(provider)}`, DEFAULT_DIRECT_MODELS[provider])),
    modelFallback: perProvider((provider) => readList(`MODEL_FALLBACK_${envSuffix(provider)}`, DEFAULT_DIRECT_FALLBACKS[provider])),
    grokBaseUrl: readString('GROK_BASE_URL', GROK_DEFAULT_BASE_URL),
    timeoutMs: readInt('AI_TIMEOUT_MS', DEFAULT_AI_TIMEOUT_MS),
    maxRetryCount: readInt('MAX_RETRY_COUNT', DEFAULT_MAX_RETRY_COUNT),
    openRouter: {
      apiKey: readOptionalString('OPENROUTER_API_KEY'),
      baseUrl: readString('OPENROUTER_BASE_URL', OPENROUTER_DEFAULT_BASE_URL),
      appUrl: readOptionalString('OPENROUTER_APP_URL'),
      appTitle: readOptionalString('OPENROUTER_APP_TITLE'),
      models: perProvider((provider) => readString(`OPENROUTER_MODEL_${envSuffix(provider)}`, OPENROUTER_DEFAULT_MODELS[provider])),
      fallbacks: perProvider((provider) => readList(`OPENROUTER_FALLBACK_${envSuffix(provider)}`, [])),
      providerSort: readOptionalString('OPENROUTER_PROVIDER_SORT')
        ? readEnum('OPENROUTER_PROVIDER_SORT', OpenRouterProviderSort, OpenRouterProviderSort.PRICE)
        : undefined,
      allowProviderFallbacks: readBoolean('OPENROUTER_ALLOW_FALLBACKS', true),
      maxTokens: readInt('OPENROUTER_MAX_TOKENS', OPENROUTER_DEFAULT_MAX_TOKENS),
    },
  };
}
