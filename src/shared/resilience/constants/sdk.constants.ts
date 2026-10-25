/**
 * SDK-level retries are disabled: AIInvocationService is the single retry layer
 * (backoff + error classification + model fallback). The OpenAI/Anthropic SDKs
 * otherwise retry 429/5xx twice on their own, silently tripling every attempt.
 */
export const SDK_MAX_RETRIES = 0;
