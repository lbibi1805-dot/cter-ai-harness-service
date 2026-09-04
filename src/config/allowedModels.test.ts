import { describe, expect, it } from 'vitest';
import { ALLOWED_MODELS, getModelApiMode, isValidModel } from './allowedModels';

describe('OpenAI model catalog', () => {
  it('accepts GPT-6 Astra and Codex models', () => {
    for (const model of ['gpt-6-astra', 'gpt-5.3-codex', 'gpt-5.2-codex', 'gpt-5.1-codex', 'gpt-5.1-codex-mini', 'codex-mini-latest']) {
      expect(isValidModel('openai', model)).toBe(true);
      expect(ALLOWED_MODELS.openai).toContain(model);
      expect(getModelApiMode('openai', model)).toBe('responses');
    }
  });

  it('keeps legacy OpenAI models on Chat Completions', () => {
    expect(getModelApiMode('openai', 'gpt-5')).toBe('chat-completions');
    expect(getModelApiMode('openai', 'not-a-model')).toBeNull();
  });
});
