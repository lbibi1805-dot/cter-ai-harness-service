import { AIProvider } from '../../domain/enums/ai.enums';

/** Environment variable holding each provider's direct API key. */
export const PROVIDER_KEY_ENV: Readonly<Record<AIProvider, string>> = {
  [AIProvider.CLAUDE]: 'CLAUDE_API_KEY',
  [AIProvider.GEMINI]: 'GEMINI_API_KEY',
  [AIProvider.GROK]: 'GROK_API_KEY',
  [AIProvider.OPENAI]: 'OPENAI_API_KEY',
};

export const OPENROUTER_KEY_ENV = 'OPENROUTER_API_KEY';
