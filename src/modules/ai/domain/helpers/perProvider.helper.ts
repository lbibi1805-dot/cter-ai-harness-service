import { type AIProvider } from '../enums/ai.enums';
import type { PerProvider } from '../interfaces/aiConfig.interface';
import { AI_PROVIDERS } from '../constants/ai.constants';

/** Builds a value for every provider, e.g. `perProvider((p) => readKey(p))`. */
export function perProvider<T>(valueFor: (provider: AIProvider) => T): PerProvider<T> {
  return Object.fromEntries(AI_PROVIDERS.map((provider) => [provider, valueFor(provider)])) as PerProvider<T>;
}
