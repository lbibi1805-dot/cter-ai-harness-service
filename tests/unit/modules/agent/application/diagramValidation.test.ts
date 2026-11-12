import { describe, it, expect, vi } from 'vitest';
import {
  AgentToolName,
  ModelTurnKind,
  TOOL_REFERENCE_CLOSE,
  TOOL_REFERENCE_OPEN,
  type AgentTool,
  type DiagramCheck,
  type DiagramRepairer,
  type DiagramValidator,
  type ModelTurn,
  type ToolCallingModel,
  type ToolOutput,
} from '../../../../../src/modules/agent/domain';
import { BUDGET_EXHAUSTED_NOTE } from '../../../../../src/modules/agent/domain';
import { AgentRunner } from '../../../../../src/modules/agent/application/agentRunner.service';
import { DiagramSyntaxGuard } from '../../../../../src/modules/agent/application/diagramSyntaxGuard.service';
import { ClientAnswerService } from '../../../../../src/modules/agent/application/clientAnswer.service';
import { ValidateDiagramTool, describeSyntaxError } from '../../../../../src/modules/agent/infrastructure/tools/validateDiagram.tool';
import { VaultSearchTool } from '../../../../../src/modules/agent/infrastructure/tools/vaultSearch.tool';

const USAGE = { inputTokens: 1, outputTokens: 1 };
const CONTENT = { textContent: 'Q?', imageBuffers: [] };
const GOOD = '@startuml\nPerson(a, "A", "d")\n@enduml';
const BAD = '@startuml\nRel(a, b, "x"\n@enduml';
const FIXED = '@startuml\nRel(a, b, "x")\n@enduml';

const calls = (...items: Array<[string, Record<string, unknown>]>): ModelTurn => ({
  kind: ModelTurnKind.TOOL_CALLS,
  calls: items.map(([name, args], i) => ({ id: `c${i}-${name}`, name, arguments: JSON.stringify(args) })),
  usage: USAGE,
});
const final = (text: string): ModelTurn => ({ kind: ModelTurnKind.FINAL, text, usage: USAGE });

function scriptedModel(turns: ModelTurn[]) {
  const received: Array<{ outputs: ToolOutput[]; allowTools: boolean }> = [];
  const model: ToolCallingModel = {
    model: 'm',
    startSession: () => ({
      next: async (outputs, { allowTools }) => {
        received.push({ outputs, allowTools });
        const turn = turns.shift();
        if (!turn) throw new Error('script exhausted');
        return turn;
      },
    }),
  };
  return { model, received };
}

/** Renders: a source containing `Rel(a, b, "x"` without the closing paren is a syntax error on line 2. */
function fakeValidator(): DiagramValidator & { validate: ReturnType<typeof vi.fn> } {
  return {
    validate: vi.fn(async (source: string): Promise<DiagramCheck> => (source.includes('"x"\n') && !source.includes('"x")')
      ? { ok: false, error: 'Fatal parsing error', line: 2 }
      : { ok: true })),
  };
}

function fenced(...blocks: string[]): string {
  return ['Intro.', ...blocks.map((b) => `\`\`\`plantuml\n${b}\n\`\`\``), 'End.'].join('\n\n');
}

describe('validate_diagram tool (12/11 plan 03 §4)', () => {
  it('returns OK, or the syntax error with its line and the numbered lines around it', async () => {
    const tool = new ValidateDiagramTool(fakeValidator());
    expect((await tool.execute({ source: GOOD })).content).toBe('OK');
    const error = (await tool.execute({ source: BAD })).content;
    expect(error).toMatch(/^SYNTAX ERROR line 2: Fatal parsing error/);
    expect(error).toContain('> 2: Rel(a, b, "x"');
    expect(describeSyntaxError(BAD, 'boom')).toBe('SYNTAX ERROR: boom');
  });

  it('has its own budget: diagram checks never use up the research calls, and stop at AGENT_MAX_DIAGRAM_VALIDATIONS', async () => {
    const search: AgentTool = { name: AgentToolName.SEARCH_VAULT, description: 's', parameters: {}, execute: vi.fn(async () => ({ content: 'hits', sources: ['a.md'] })) };
    const validator = fakeValidator();
    const { model, received } = scriptedModel([
      calls([AgentToolName.SEARCH_VAULT, { query: 'a' }]),
      calls([AgentToolName.VALIDATE_DIAGRAM, { source: BAD }], [AgentToolName.VALIDATE_DIAGRAM, { source: FIXED }], [AgentToolName.VALIDATE_DIAGRAM, { source: GOOD }]),
      calls([AgentToolName.SEARCH_VAULT, { query: 'b' }]),
      final('answer'),
    ]);
    const runner = new AgentRunner([search, new ValidateDiagramTool(validator)], { maxToolCalls: 2, minToolCalls: 0, maxDurationMs: 60_000, maxToolResultChars: 500, maxDiagramValidations: 2 });
    const result = await runner.run({ model, systemPrompt: 's', content: CONTENT, label: 'q' });

    expect(result.text).toBe('answer');
    // 2 diagram checks ran, the 3rd got the budget note; the 2nd search still ran (research budget 2).
    expect(validator.validate).toHaveBeenCalledTimes(2);
    expect(received[2].outputs.map((o) => o.output)).toEqual([expect.stringMatching(/^SYNTAX ERROR line 2/), 'OK', BUDGET_EXHAUSTED_NOTE]);
    expect(search.execute).toHaveBeenCalledTimes(2);
    expect(received[3].outputs[0].output).toBe('hits');
  });
});

describe('vault tool output is reference material (12/11 02 Bước 3)', () => {
  it('search_vault output is wrapped in the reference-only label; other tools are not', async () => {
    const vault = new VaultSearchTool({ search: async () => [{ chunkId: 'c', text: 'Mutex text', source: 'lab/Mutex.md', heading: 'H', parentHeading: '', tokenCount: 1, score: 0.9 }] });
    const { model, received } = scriptedModel([
      calls([AgentToolName.SEARCH_VAULT, { query: 'mutex' }], [AgentToolName.VALIDATE_DIAGRAM, { source: GOOD }]),
      final('answer'),
    ]);
    await new AgentRunner([vault, new ValidateDiagramTool(fakeValidator())], { maxToolCalls: 3, minToolCalls: 0, maxDurationMs: 60_000, maxToolResultChars: 5000, maxDiagramValidations: 3 })
      .run({ model, systemPrompt: 's', content: CONTENT, label: 'q' });
    const [searchOut, validateOut] = received[1].outputs.map((o) => o.output);
    expect(searchOut.startsWith(TOOL_REFERENCE_OPEN)).toBe(true);
    expect(searchOut.endsWith(TOOL_REFERENCE_CLOSE)).toBe(true);
    expect(searchOut).toContain('Mutex text');
    expect(validateOut).toBe('OK');
  });
});

describe('DiagramSyntaxGuard (12/11 plan 03 §5)', () => {
  const settings = { enabled: true, maxRepairs: 1 };
  const far = () => Date.now() + 60_000;

  it('leaves an answer without PlantUML untouched (no timings)', async () => {
    const validator = fakeValidator();
    const out = await new DiagramSyntaxGuard(settings, validator, null).check('no diagram', far(), 'q');
    expect(out).toEqual({ text: 'no diagram' });
    expect(validator.validate).not.toHaveBeenCalled();
  });

  it('keeps blocks that render; replaces a broken block with its repaired version', async () => {
    const repairer: DiagramRepairer = { repair: vi.fn(async () => FIXED) };
    const guard = new DiagramSyntaxGuard(settings, fakeValidator(), repairer);
    const progress = vi.fn();
    const out = await guard.check(fenced(GOOD, BAD), far(), 'q', { delta: () => undefined, reset: () => undefined, progress });
    expect(out.text).toBe(fenced(GOOD, FIXED));
    expect(out.timings).toMatchObject({ diagramBlocks: 2, diagramRepairs: 1, diagramRepairFailed: 0 });
    expect(repairer.repair).toHaveBeenCalledWith(expect.objectContaining({ source: BAD, error: 'Fatal parsing error', line: 2 }));
    expect(progress).toHaveBeenCalledWith({ stage: 'validating-diagram' });
    expect(guard.stats()).toMatchObject({ answers: 1, blocks: 2, repairs: 1, repairFailed: 0 });
  });

  it('keeps the original when the repair is still broken, empty, or there is no repairer', async () => {
    const still = new DiagramSyntaxGuard(settings, fakeValidator(), { repair: async () => BAD });
    expect(await still.check(fenced(BAD), far(), 'q')).toMatchObject({ text: fenced(BAD), timings: { diagramRepairs: 0, diagramRepairFailed: 1 } });
    const empty = new DiagramSyntaxGuard(settings, fakeValidator(), { repair: async () => null });
    expect((await empty.check(fenced(BAD), far(), 'q')).text).toBe(fenced(BAD));
    const none = new DiagramSyntaxGuard(settings, fakeValidator(), null);
    expect((await none.check(fenced(BAD), far(), 'q')).timings?.diagramRepairFailed).toBe(1);
  });

  it('skips the check when the deadline is too close, and keeps the text when the renderer fails', async () => {
    const validator = fakeValidator();
    const late = new DiagramSyntaxGuard(settings, validator, null);
    expect((await late.check(fenced(BAD), Date.now() + 100, 'q')).text).toBe(fenced(BAD));
    expect(validator.validate).not.toHaveBeenCalled();
    expect(late.stats().skipped).toBe(1);
    const down = new DiagramSyntaxGuard(settings, { validate: async () => { throw new Error('plantuml down'); } }, { repair: vi.fn() });
    expect(await down.check(fenced(BAD), far(), 'q')).toMatchObject({ text: fenced(BAD), timings: { diagramRepairs: 0, diagramRepairFailed: 0 } });
  });

  it('ClientAnswerService runs the guard on the final text and merges the timings', async () => {
    const inner = { answer: async () => ({ text: fenced(BAD), model: 'm', attempts: 1, contexts: [], timings: { totalMs: 5, attempts: [] } }) };
    const guard = new DiagramSyntaxGuard(settings, fakeValidator(), { repair: async () => FIXED });
    const result = await new ClientAnswerService(inner, guard).answer({ provider: 'gemini' as never, model: 'm', content: CONTENT, label: 'q' });
    expect(result.text).toContain(FIXED);
    expect(result.timings).toMatchObject({ totalMs: 5, diagramBlocks: 1, diagramRepairs: 1 });
    const off = new DiagramSyntaxGuard({ enabled: false, maxRepairs: 1 }, fakeValidator(), null);
    expect((await new ClientAnswerService(inner, off).answer({ provider: 'gemini' as never, model: 'm', content: CONTENT, label: 'q' })).text).toContain(BAD);
  });
});
