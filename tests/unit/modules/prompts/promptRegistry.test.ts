import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { PromptRegistry, PromptKind, createPromptRegistry, type RawPromptFile } from '../../../../src/modules/prompts';
import { ConfigurationError } from '../../../../src/shared/errors';

function file(filePath: string, id: string, body: string, extra = ''): RawPromptFile {
  return { path: filePath, content: `---\nid: ${id}\nversion: 1.0.0\nowner: test\ndescription: d\n${extra}---\n\n${body}\n` };
}

const BASE: RawPromptFile[] = [
  file('policies/language.md', 'policy.language', 'LANGUAGE', 'order: 10\n'),
  file('core/system.md', 'core.system', 'CORE'),
  file('policies/citation.md', 'policy.citation', 'CITATION', 'order: 20\n'),
  file('domains/usability.md', 'domain.usability', 'USABILITY', 'static: true\nmatch: ["*usability*"]\n'),
  file('domains/testing.md', 'domain.testing', 'TESTING', 'match:\n  - "software-tes*ing-*"\n  - istqb\n'),
  file('skills/c4/architect.md', 'skill.c4.architect', 'ARCHITECT'),
  { path: 'README.md', content: 'not a prompt' },
];

describe('PromptRegistry', () => {
  it('composes core → policies (by order) → static domains; skills and other domains stay out', () => {
    const registry = new PromptRegistry(BASE);
    expect(registry.systemPrompt).toBe('CORE\n\nLANGUAGE\n\nCITATION\n\nUSABILITY');
  });

  it('composition order does not depend on the file listing order', () => {
    expect(new PromptRegistry([...BASE].reverse()).systemPrompt).toBe(new PromptRegistry(BASE).systemPrompt);
  });

  it('fails when a file has no frontmatter or misses a required field', () => {
    expect(() => new PromptRegistry([...BASE, { path: 'policies/x.md', content: 'just text' }])).toThrow(ConfigurationError);
    const noOwner = { path: 'policies/x.md', content: '---\nid: p.x\nversion: 1\ndescription: d\n---\nbody' };
    expect(() => new PromptRegistry([...BASE, noOwner])).toThrow(/owner/);
  });

  it('fails without a core prompt or with a duplicate id', () => {
    expect(() => new PromptRegistry(BASE.filter((f) => !f.path.startsWith('core/')))).toThrow(/core/);
    expect(() => new PromptRegistry([...BASE, file('policies/dup.md', 'policy.language', 'X')])).toThrow(/duplicate/);
  });

  it('promptVersion is a stable 12-hex hash that changes when a core file changes', () => {
    const a = new PromptRegistry(BASE).promptVersion;
    expect(a).toMatch(/^[0-9a-f]{12}$/);
    expect(new PromptRegistry(BASE).promptVersion).toBe(a);
    const changed = BASE.map((f) => (f.path === 'core/system.md' ? file('core/system.md', 'core.system', 'CORE v2') : f));
    expect(new PromptRegistry(changed).promptVersion).not.toBe(a);
  });

  it('a skill or non-static domain edit does not change promptVersion (layer ① stays cached)', () => {
    const a = new PromptRegistry(BASE).promptVersion;
    const changed = BASE.map((f) => (f.path === 'skills/c4/architect.md' ? file(f.path, 'skill.c4.architect', 'ARCHITECT v2') : f));
    expect(new PromptRegistry(changed).promptVersion).toBe(a);
  });

  it('looks up domains and skills by id or file name', () => {
    const registry = new PromptRegistry(BASE);
    expect(registry.domain('domain.testing')?.body).toBe('TESTING');
    expect(registry.domain('usability')?.body).toBe('USABILITY');
    expect(registry.skill('skill.c4.architect')?.body).toBe('ARCHITECT');
    expect(registry.skill('missing')).toBeNull();
  });

  it('selectDomain picks the domain matching most RAG sources', () => {
    const registry = new PromptRegistry(BASE);
    expect(registry.selectDomain(['software-tesing-ISYS2092-SYS3397/w1.md', 'istqb-embedding/x.md', 'Usability/a.md'])?.meta.id).toBe('domain.testing');
    expect(registry.selectDomain(['usability-engineering/heuristics.md'])?.meta.id).toBe('domain.usability');
    expect(registry.selectDomain(['Week-02/Lecture.md'])).toBeNull();
  });

  it('list() reports every prompt file with hash and whether it is in the static prompt', () => {
    const list = new PromptRegistry(BASE).list();
    expect(list).toHaveLength(6);
    expect(list.find((e) => e.id === 'core.system')).toMatchObject({ kind: PromptKind.CORE, active: true, version: '1.0.0' });
    expect(list.find((e) => e.id === 'domain.testing')?.active).toBe(false);
    expect(list.find((e) => e.id === 'skill.c4.architect')).toMatchObject({ kind: PromptKind.SKILL, active: false });
  });
});

describe('prompts/ in the repo', () => {
  const registry = createPromptRegistry(path.resolve(__dirname, '../../../../prompts'));

  it('loads and validates every file', () => {
    expect(registry.list().length).toBeGreaterThan(5);
    expect(registry.skill('skill.c4.system')?.body).toContain('C4 model diagrams');
  });

  it('the static prompt has no References demand and no unexecutable "read file" order', () => {
    expect(registry.systemPrompt).not.toMatch(/## References/);
    expect(registry.systemPrompt).not.toContain('PHẢI đọc');
    expect(registry.systemPrompt).not.toContain('software-testing-ISYS2092');
  });

  it('usability rubric lives in a domain file, not in core', () => {
    expect(registry.list().find((e) => e.id === 'core.system')).toBeDefined();
    const core = new PromptRegistry([{ path: 'core/system.md', content: fs.readFileSync(path.resolve(__dirname, '../../../../prompts/core/system.md'), 'utf-8') }]);
    expect(core.systemPrompt).not.toContain('HEURISTIC EVALUATION');
    expect(registry.domain('usability-engineering')?.body).toContain('HEURISTIC EVALUATION');
  });
});
