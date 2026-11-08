import {
  DEFAULT_AI_LATENCY,
  DEFAULT_AI_TIMEOUT_MS,
  DEFAULT_PROVIDER_TUNING,
  GeminiThinkingLevel,
  OpenAIReasoningEffort,
  OpenAIServiceTier,
  PromptCacheKeyMode,
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
  type AiLatencySettings,
  type ProviderTuning,
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
    latency: readLatencySettings(),
    tuning: readProviderTuning(),
  };
}

/** First-token / idle / whole-request limits and the model circuit breaker (07 §3.2). */
function readLatencySettings(): AiLatencySettings {
  const circuit = DEFAULT_AI_LATENCY.circuit;
  return {
    firstTokenTimeoutMs: readInt('AI_FIRST_TOKEN_TIMEOUT_MS', DEFAULT_AI_LATENCY.firstTokenTimeoutMs),
    idleTimeoutMs: readInt('AI_IDLE_TIMEOUT_MS', DEFAULT_AI_LATENCY.idleTimeoutMs),
    chatDeadlineMs: readInt('CHAT_DEADLINE_MS', DEFAULT_AI_LATENCY.chatDeadlineMs),
    canvasDeadlineMs: readInt('CANVAS_DEADLINE_MS', DEFAULT_AI_LATENCY.canvasDeadlineMs),
    circuit: {
      failureThreshold: readInt('AI_CIRCUIT_FAILURE_THRESHOLD', circuit.failureThreshold),
      windowMs: readInt('AI_CIRCUIT_WINDOW_MS', circuit.windowMs),
      cooldownMs: readInt('AI_CIRCUIT_COOLDOWN_MS', circuit.cooldownMs),
    },
  };
}

/** Thinking / reasoning / output cap / prompt caching per provider (07 §3.3, 18 §5). */
function readProviderTuning(): ProviderTuning {
  return {
    maxOutputTokens: readInt('AI_MAX_OUTPUT_TOKENS', DEFAULT_PROVIDER_TUNING.maxOutputTokens),
    geminiThinkingLevel: readEnum('GEMINI_THINKING_LEVEL', GeminiThinkingLevel, DEFAULT_PROVIDER_TUNING.geminiThinkingLevel),
    openaiReasoningEffort: readEnum('OPENAI_REASONING_EFFORT', OpenAIReasoningEffort, DEFAULT_PROVIDER_TUNING.openaiReasoningEffort),
    openaiServiceTier: readOptionalString('OPENAI_SERVICE_TIER')
      ? readEnum('OPENAI_SERVICE_TIER', OpenAIServiceTier, OpenAIServiceTier.AUTO)
      : undefined,
    openaiPromptCacheKey: readEnum('OPENAI_PROMPT_CACHE_KEY', PromptCacheKeyMode, DEFAULT_PROVIDER_TUNING.openaiPromptCacheKey),
    claudePromptCache: readBoolean('PROMPT_CACHE_CLAUDE', DEFAULT_PROVIDER_TUNING.claudePromptCache),
  };
}
