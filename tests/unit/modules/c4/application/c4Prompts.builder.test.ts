import path from 'path';
import { describe, expect, it } from 'vitest';
import { C4SkillId } from '../../../../../src/modules/c4';
import { C4PromptBuilder } from '../../../../../src/modules/c4/application/c4Prompts.builder';
import { createPromptRegistry } from '../../../../../src/modules/prompts';

describe('C4 prompts from the prompt registry', () => {
  const registry = createPromptRegistry(path.resolve(process.cwd(), 'prompts'));
  const fromRegistry = new C4PromptBuilder((id) => registry.skill(id)?.body ?? null);
  const fromConstants = new C4PromptBuilder(null);

  it.each(Object.values(C4SkillId))('%s: the skill file exists and is an exact copy of the TS fallback', (id) => {
    expect(registry.skill(id)).not.toBeNull();
    expect(fromRegistry.skill(id)).toBe(fromConstants.skill(id));
  });

  it('an edited skill file is what the agents get', () => {
    const edited = new C4PromptBuilder((id) => (id === C4SkillId.REVIEW ? 'REVIEW v2' : null));
    expect(edited.review('brief', '{}', 'A1')).toContain('REVIEW v2');
    expect(edited.system()).toBe(fromConstants.system());
  });
});
