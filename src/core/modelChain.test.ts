import { describe, it, expect } from 'vitest';
import { buildModelChain } from './modelChain';
import { getModelApiMode, ALLOWED_MODELS } from '../config/allowedModels';

/**
 * Characterization tests for core/modelChain.ts — locks in the exact behavior of the
 * duplicated `PollOrchestrator.buildModelChain` / `ConversationPoller.buildModelChain`
 * private methods (mục 6 Phase 0 step 4) before they get replaced by this shared
 * implementation in a later phase.
 */
describe('core/modelChain buildModelChain', () => {
  it('always includes primary model first', () => {
    const chain = buildModelChain('gemini', 'gemini-3.5-flash', [], getModelApiMode);
    expect(chain).toEqual(['gemini-3.5-flash']);
  });

  it('appends fallback models not equal to primary and not duplicated', () => {
    const chain = buildModelChain('gemini', 'gemini-3.5-flash', ['gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-2.5-flash'], getModelApiMode);
    expect(chain).toEqual(['gemini-3.5-flash', 'gemini-2.5-flash']);
  });

  it('for non-openai providers, includes fallback regardless of api-mode resolver', () => {
    // getModelApiMode always returns null for non-openai providers, so mode filtering
    // never excludes anything for claude/gemini/grok — table-driven over real models.
    const chain = buildModelChain('claude', ALLOWED_MODELS.claude[0], ALLOWED_MODELS.claude.slice(1), getModelApiMode);
    expect(chain).toEqual(ALLOWED_MODELS.claude);
  });

  it('for openai provider, filters fallback models with a different API mode than primary (chat-completions primary)', () => {
    // gpt-4o is chat-completions; gpt-6-astra/codex family are 'responses' mode.
    const chain = buildModelChain('openai', 'gpt-4o', ['gpt-5', 'gpt-6-astra', 'gpt-4o-mini'], getModelApiMode);
    expect(chain).toEqual(['gpt-4o', 'gpt-5', 'gpt-4o-mini']);
    expect(chain).not.toContain('gpt-6-astra');
  });

  it('for openai provider, filters fallback models with a different API mode than primary (responses primary)', () => {
    const chain = buildModelChain('openai', 'gpt-6-astra', ['gpt-4o', 'gpt-5.3-codex'], getModelApiMode);
    expect(chain).toEqual(['gpt-6-astra', 'gpt-5.3-codex']);
    expect(chain).not.toContain('gpt-4o');
  });

  it('matches the full real ALLOWED_MODELS.openai chain semantics end-to-end', () => {
    const chain = buildModelChain('openai', 'gpt-5', ALLOWED_MODELS.openai, getModelApiMode);
    const expected = ['gpt-5', ...ALLOWED_MODELS.openai.filter(
      m => m !== 'gpt-5' && getModelApiMode('openai', m) === getModelApiMode('openai', 'gpt-5'),
    )];
    expect(chain).toEqual(expected);
  });
});
