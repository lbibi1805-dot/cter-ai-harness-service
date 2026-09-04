import type { AIProviderName } from '../types';

export const ALLOWED_MODELS: Record<AIProviderName, string[]> = {
  claude: [
    'claude-sonnet-4-6',
    'claude-opus-4-6',
    'claude-opus-4-5-20251101',
    'claude-haiku-4-5-20251001',
    'claude-sonnet-4-5-20250929',
    'claude-opus-4-1-20250805',
  ],
  // Available models for FREE Gemini token (June 2026+).
  // gemini-2.0-flash: shut down 2026-06-01.
  // gemini-2.5-flash: restricted for new users, shutdown 2026-10-16.
  gemini: [
    'gemini-3.5-flash',
    'gemini-3.1-flash-lite',
    'gemini-3.1-flash-lite-preview',
    'gemini-3-flash-preview',
    'gemini-3.1-pro-preview',
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash',
  ],
  grok: [
    'grok-4.3',
    'grok-3',
    'grok-4.20-0309-reasoning',
    'grok-4.20-0309-non-reasoning',
    'grok-4-1-fast-reasoning',
    'grok-4-1-fast-non-reasoning',
    'grok-4-fast-reasoning',
    'grok-4-fast-non-reasoning',
    'grok-code-fast-1',
  ],
  openai: [
    'gpt-5',
    'gpt-5-mini',
    'o3-mini',
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-6-astra',
    'gpt-5.3-codex',
    'gpt-5.2-codex',
    'gpt-5.1-codex',
    'gpt-5.1-codex-mini',
    'codex-mini-latest',
  ],
};

export function isValidModel(provider: AIProviderName, model: string): boolean {
  return ALLOWED_MODELS[provider].includes(model);
}

export type OpenAIApiMode = 'chat-completions' | 'responses';

const RESPONSES_MODELS = new Set([
  'gpt-6-astra',
  'gpt-5.3-codex',
  'gpt-5.2-codex',
  'gpt-5.1-codex',
  'gpt-5.1-codex-mini',
  'codex-mini-latest',
]);

export function getModelApiMode(provider: AIProviderName, model: string): OpenAIApiMode | null {
  if (provider !== 'openai' || !isValidModel(provider, model)) return null;
  return RESPONSES_MODELS.has(model) ? 'responses' : 'chat-completions';
}
