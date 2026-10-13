import { getModelApiMode } from '../../../config/allowedModels';
import type { AIProviderName } from '../../../types';

/**
 * Primary model first, then the configured fallbacks (deduplicated). OpenAI
 * fallbacks must share the primary's API mode (Responses vs Chat Completions).
 */
export function buildModelChain(provider: AIProviderName, primaryModel: string, fallbacks: string[]): string[] {
  const primaryMode = getModelApiMode(provider, primaryModel);
  const chain = [primaryModel];
  for (const model of fallbacks) {
    if (chain.includes(model)) continue;
    if (provider === 'openai' && getModelApiMode(provider, model) !== primaryMode) continue;
    chain.push(model);
  }
  return chain;
}
