import { describe, expect, it } from 'vitest';
import {
  AIProvider,
  DIRECT_ALLOWED_MODELS,
  ModelCatalog,
  OpenAIApiMode,
  getOpenAIApiMode,
} from '../../../../../src/modules/ai';
import { buildTestAiConfig, perProvider } from '../../../../support/configFixture';

describe('OpenAI model catalog', () => {
  it('accepts GPT-6 Astra and Codex models on the Responses API', () => {
    for (const model of ['gpt-6-astra', 'gpt-5.3-codex', 'gpt-5.2-codex', 'gpt-5.1-codex', 'gpt-5.1-codex-mini', 'codex-mini-latest']) {
      expect(DIRECT_ALLOWED_MODELS[AIProvider.OPENAI]).toContain(model);
      expect(getOpenAIApiMode(AIProvider.OPENAI, model)).toBe(OpenAIApiMode.RESPONSES);
    }
  });

  it('keeps legacy OpenAI models on Chat Completions', () => {
    expect(getOpenAIApiMode(AIProvider.OPENAI, 'gpt-5')).toBe(OpenAIApiMode.CHAT_COMPLETIONS);
    expect(getOpenAIApiMode(AIProvider.OPENAI, 'not-a-model')).toBeNull();
  });
});

describe('ModelCatalog', () => {
  const catalog = (fallbacks: string[], openRouterKey?: string) => {
    const base = buildTestAiConfig();
    return new ModelCatalog(buildTestAiConfig({
      modelFallback: perProvider(() => fallbacks),
      openRouter: { ...base.openRouter, apiKey: openRouterKey, models: perProvider((provider) => `vendor/${provider}`) },
    }));
  };

  it('puts the primary first and de-duplicates fallbacks', () => {
    expect(catalog(['g-1', 'g-2', 'g-3']).chainFor(AIProvider.GEMINI, 'g-2')).toEqual(['g-2', 'g-1', 'g-3']);
  });

  it('keeps OpenAI fallbacks within the same API mode', () => {
    expect(catalog(['gpt-5.3-codex', 'gpt-4o', 'gpt-5']).chainFor(AIProvider.OPENAI, 'gpt-6-astra')).toEqual(['gpt-6-astra', 'gpt-5.3-codex']);
    expect(catalog(['gpt-5.3-codex', 'gpt-5', 'gpt-4o-mini']).chainFor(AIProvider.OPENAI, 'gpt-4o')).toEqual(['gpt-4o', 'gpt-5', 'gpt-4o-mini']);
  });

  it('only lets clients name direct models (OpenRouter ids are backend-only)', () => {
    const withOpenRouter = catalog([], 'or-key');
    expect(withOpenRouter.isAllowed(AIProvider.GEMINI, 'gemini-3.5-flash')).toBe(true);
    expect(withOpenRouter.isAllowed(AIProvider.GEMINI, 'vendor/gemini')).toBe(false);
    expect(withOpenRouter.allowedModels(AIProvider.GEMINI)).not.toContain('vendor/gemini');
  });

  it('exposes the OpenRouter fallback model only when OpenRouter is configured', () => {
    expect(catalog([]).openRouterFallback(AIProvider.CLAUDE)).toBeNull();
    expect(catalog([], 'or-key').openRouterFallback(AIProvider.CLAUDE)).toBe('vendor/claude');
  });
});
