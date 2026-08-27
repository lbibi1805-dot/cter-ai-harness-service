import type { AIAdapter, AIProviderName, AppConfig } from '../types';
import { ClaudeAdapter } from './claudeAdapter';
import { GeminiAdapter } from './geminiAdapter';
import { GrokAdapter } from './grokAdapter';

export interface KeyValidationResult {
  provider: AIProviderName;
  ok: boolean;
  error?: string;
}

export async function validateAllKeys(
  aiKeys: AppConfig['aiKeys'],
  grokBaseUrl: string,
): Promise<KeyValidationResult[]> {
  const tasks: Promise<KeyValidationResult>[] = [];

  if (aiKeys.claude) {
    tasks.push(
      new ClaudeAdapter(aiKeys.claude).validate()
        .then((): KeyValidationResult => ({ provider: 'claude', ok: true }))
        .catch((e: Error): KeyValidationResult => ({ provider: 'claude', ok: false, error: e.message }))
    );
  }
  if (aiKeys.gemini) {
    tasks.push(
      new GeminiAdapter(aiKeys.gemini).validate()
        .then((): KeyValidationResult => ({ provider: 'gemini', ok: true }))
        .catch((e: Error): KeyValidationResult => ({ provider: 'gemini', ok: false, error: e.message }))
    );
  }
  if (aiKeys.grok) {
    tasks.push(
      new GrokAdapter(aiKeys.grok, grokBaseUrl).validate()
        .then((): KeyValidationResult => ({ provider: 'grok', ok: true }))
        .catch((e: Error): KeyValidationResult => ({ provider: 'grok', ok: false, error: e.message }))
    );
  }

  return Promise.all(tasks);
}

type AdapterFactory = (
  aiKeys: AppConfig['aiKeys'],
  grokBaseUrl: string,
) => AIAdapter;

const ADAPTER_FACTORIES: Record<AIProviderName, AdapterFactory> = {
  claude: (aiKeys) => {
    if (!aiKeys.claude) throw new Error('CLAUDE_API_KEY not configured');
    return new ClaudeAdapter(aiKeys.claude);
  },
  gemini: (aiKeys) => {
    if (!aiKeys.gemini) throw new Error('GEMINI_API_KEY not configured');
    return new GeminiAdapter(aiKeys.gemini);
  },
  grok: (aiKeys, grokBaseUrl) => {
    if (!aiKeys.grok) throw new Error('GROK_API_KEY not configured');
    return new GrokAdapter(aiKeys.grok, grokBaseUrl);
  },
};

export function createAIAdapter(
  provider: AIProviderName,
  aiKeys: AppConfig['aiKeys'],
  grokBaseUrl: string
): AIAdapter {
  return ADAPTER_FACTORIES[provider](aiKeys, grokBaseUrl);
}

export function resolveModel(
  provider: AIProviderName,
  modelFromFileName: string | undefined,
  defaultModels: AppConfig['defaultModels']
): string {
  return modelFromFileName ?? defaultModels[provider];
}
