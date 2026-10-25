import { AIProvider } from '../enums/ai.enums';
import { AI_PROVIDERS } from '../constants/ai.constants';

/** Case-insensitive; null for anything that is not a servable provider. */
export function parseAIProvider(value: string | undefined): AIProvider | null {
  const normalized = value?.trim().toLowerCase();
  return AI_PROVIDERS.find((provider) => provider === normalized) ?? null;
}
