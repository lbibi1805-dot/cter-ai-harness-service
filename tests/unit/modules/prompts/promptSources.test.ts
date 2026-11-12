import * as path from 'path';
import { describe, it, expect } from 'vitest';
import { PromptPreparer, RagAvailability } from '../../../../src/modules/ai';
import { PromptCacheLayout } from '../../../../src/modules/ai/domain/enums/promptLayout.enums';
import { buildAgentSystemPrompt, renderResearchMode } from '../../../../src/modules/agent/application/agentPrompt.builder';
import { RESEARCH_MODE_FALLBACK } from '../../../../src/modules/agent/application/constants/agentPrompt.constants';
import { buildAgentBudget } from '../../../../src/modules/agent/domain/agentBudget';
import { C4PromptBuilder } from '../../../../src/modules/c4/application/c4Prompts.builder';
import { legacyPromptInSync } from '../../../../src/bootstrap/startup/legacyPrompt';
import { PromptId, PromptPath, REMINDER_FALLBACK, createPromptRegistry } from '../../../../src/modules/prompts';

const ROOT = path.resolve(__dirname, '../../../..');
const registry = createPromptRegistry(path.join(ROOT, 'prompts'));
const budget = buildAgentBudget({ maxToolCalls: 6, minToolCalls: 1, maxDurationMs: 1000, maxDiagramValidations: 3 });
const reminder = registry.policy(PromptId.REMINDER)!.body;
const researchMode = registry.skill(PromptId.RESEARCH_MODE)!.body;

/** Removes every prompt file body (as composed) from `text`: what is left was written by the code. */
function leftoverAfterPromptFiles(text: string, bodies: string[]): string {
  return bodies.reduce((rest, body) => rest.split(body).join(''), text).trim();
}

describe('12/11 02 Bước 5: every instruction comes from prompts/', () => {
  it('the composition starts with policy.precedence and includes the new policies; reminder is not in the system prompt', () => {
    const ids = registry.staticLayers().map((l) => `${l.id}@${l.version}`);
    expect(ids[0]).toBe('policy.precedence@1.0.0');
    expect(ids).toEqual(expect.arrayContaining(['core.system@2.1.0', 'policy.citation@2.0.0', 'policy.conversation@1.0.0', 'policy.diagram-syntax@1.0.0', 'domain.system-architecture@1.3.0']));
    expect(ids.some((id) => id.startsWith('policy.reminder'))).toBe(false);
    expect(registry.systemPrompt).not.toContain('[REMINDER]');
    expect(registry.systemPrompt).not.toContain('### C4 Diagrams in System Diagrams.');
  });

  it('single-shot: system prompt = registry composition exactly; the reminder closes the user text', async () => {
    const preparer = new PromptPreparer(registry.systemPrompt, 'KB', new RagAvailability(), PromptCacheLayout.V2, reminder);
    const prepared = await preparer.prepare({ textContent: 'question', imageBuffers: [] });
    expect(prepared.systemPrompt).toBe(registry.systemPrompt);
    expect(prepared.content.textContent.endsWith(reminder)).toBe(true);
    expect(prepared.content.textContent.indexOf('question')).toBeLessThan(prepared.content.textContent.indexOf(reminder));
    expect(prepared.content.textContent.startsWith('[REFERENCE MATERIAL')).toBe(true);
  });

  it('agent: system prompt = composition + research-mode file (placeholders filled), nothing else', () => {
    const system = buildAgentSystemPrompt(registry.systemPrompt, budget, researchMode);
    expect(system).toBe(`${registry.systemPrompt}\n\n${renderResearchMode(researchMode, budget)}`);
    expect(system).not.toMatch(/\{\{\w+\}\}/);
    expect(system).toContain('at most 6 research tool calls');
  });

  it('/c4: system prompt = precedence + domain system-architecture + skill.c4.system, nothing else', () => {
    const skills = (id: string) => registry.skill(id)?.body ?? null;
    const builder = new C4PromptBuilder(skills, registry.c4Rules(), reminder);
    const system = builder.system();
    const bodies = [registry.policy(PromptId.PRECEDENCE)!.body, registry.domain(PromptId.C4_DOMAIN)!.body, registry.skill(PromptId.C4_SYSTEM)!.body];
    expect(leftoverAfterPromptFiles(system, bodies)).toBe('');
    expect(system.indexOf('INSTRUCTION PRECEDENCE')).toBeLessThan(system.indexOf('SYSTEM ARCHITECTURE'));
    expect(system).toContain('Microservice database ownership');
    expect(builder.reviewSystem()).toContain('SYSTEM ARCHITECTURE');
    // Knowledge is reference material in the user text, before the request; the reminder closes it.
    const user = builder.userText(builder.reference([{ chunkId: 'c', text: 'NOTE', source: 'n.md', heading: 'H', parentHeading: '', tokenCount: 1 }]), 'REQUEST');
    expect(user.indexOf('NOTE')).toBeLessThan(user.indexOf('REQUEST'));
    expect(user.endsWith(reminder)).toBe(true);
    expect(user).toContain('[REFERENCE MATERIAL');
  });

  it('single-shot/agent/c4 composed system prompts contain only text from prompt files', () => {
    const staticBodies = registry.staticLayers().map((layer) => {
      const file = registry.policy(layer.id) ?? registry.domain(layer.id);
      return file?.body.replace(/\s*<essay_rubric>[\s\S]*?<\/essay_rubric>\s*/g, '\n\n').trim();
    }).filter((b): b is string => !!b);
    const agent = buildAgentSystemPrompt(registry.systemPrompt, budget, researchMode);
    // Agent minus the static composition minus research mode = nothing.
    expect(leftoverAfterPromptFiles(agent, [registry.systemPrompt, renderResearchMode(researchMode, budget)])).toBe('');
    // The static composition minus every non-core static file leaves only core/system.md.
    const coreOnly = leftoverAfterPromptFiles(registry.systemPrompt, staticBodies);
    expect(coreOnly.startsWith('<role>')).toBe(true);
    expect(coreOnly.trim().endsWith('</diagrams>')).toBe(true);
  });

  it('trace/monitoring: composition per path ends with the reminder; /c4 starts with precedence', () => {
    for (const p of [PromptPath.SINGLE, PromptPath.AGENT, PromptPath.ESSAY, PromptPath.C4]) {
      const layers = registry.composition(p);
      expect(layers[0].id).toBe('policy.precedence');
      expect(layers[layers.length - 1].id).toBe('policy.reminder');
    }
    expect(registry.composition(PromptPath.AGENT).map((l) => l.id)).toContain('skill.agent.research-mode');
    expect(registry.composition(PromptPath.C4).map((l) => l.id)).toEqual(['policy.precedence', 'domain.system-architecture', 'skill.c4.system', 'policy.reminder']);
  });

  it('built-in copies match their files (registry off), and system-prompt.md is regenerated (npm run prompts:legacy)', () => {
    expect(RESEARCH_MODE_FALLBACK).toBe(researchMode);
    expect(REMINDER_FALLBACK).toBe(reminder);
    const cwd = process.cwd();
    try {
      process.chdir(ROOT);
      expect(legacyPromptInSync(registry.systemPrompt), 'system-prompt.md is out of date: run npm run prompts:legacy').toBe(true);
    } finally {
      process.chdir(cwd);
    }
  });
});
