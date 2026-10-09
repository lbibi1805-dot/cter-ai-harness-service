import { describe, it, expect, vi } from 'vitest';
import {
  AgentStopReason,
  AgentToolName,
  ModelTurnKind,
  type AgentTool,
  type ModelTurn,
  type ToolCallingModel,
  type ToolOutput,
} from '../domain';
import { BUDGET_EXHAUSTED_NOTE } from './agentPrompt';
import { AgentRunner } from './agentRunner.service';

const USAGE = { inputTokens: 10, outputTokens: 2 };
const CONTENT = { textContent: 'Q?', imageBuffers: [] };
const BUDGET = { maxToolCalls: 3, maxDurationMs: 60_000, maxToolResultChars: 50 };

const calls = (...items: Array<[string, Record<string, unknown> | string]>): ModelTurn => ({
  kind: ModelTurnKind.TOOL_CALLS,
  calls: items.map(([name, args], i) => ({ id: `c${i}-${name}`, name, arguments: typeof args === 'string' ? args : JSON.stringify(args) })),
  usage: USAGE,
});
const final = (text: string): ModelTurn => ({ kind: ModelTurnKind.FINAL, text, usage: USAGE });

/** Model whose turns are scripted; records what the runner sent each turn. */
function scriptedModel(turns: Array<ModelTurn | ((allowTools: boolean) => ModelTurn)>) {
  const received: Array<{ outputs: ToolOutput[]; allowTools: boolean }> = [];
  const model: ToolCallingModel = {
    model: 'gpt-6-astra',
    startSession: () => ({
      next: async (outputs, { allowTools }) => {
        received.push({ outputs, allowTools });
        const turn = turns.shift();
        if (!turn) throw new Error('script exhausted');
        return typeof turn === 'function' ? turn(allowTools) : turn;
      },
    }),
  };
  return { model, received };
}

function tool(name: AgentToolName, impl: AgentTool['execute']): AgentTool {
  return { name, description: name, parameters: { type: 'object' }, execute: vi.fn(impl) };
}

const search = tool(AgentToolName.SEARCH_VAULT, async (args) => ({ content: `hits for ${String(args.query)}`, sources: ['lab-4/Mutex.md'] }));
const read = tool(AgentToolName.READ_DOCUMENT, async (args) => ({ content: 'x'.repeat(200), sources: [String(args.path)] }));

describe('AgentRunner', () => {
  it('runs tools until the model answers, collecting sources and usage', async () => {
    const { model, received } = scriptedModel([
      calls([AgentToolName.SEARCH_VAULT, { query: 'mutex' }]),
      calls([AgentToolName.READ_DOCUMENT, { path: 'lab-4/Barriers.md' }]),
      final('# Answer'),
    ]);
    const result = await new AgentRunner([search, read], BUDGET).run({ model, systemPrompt: 's', content: CONTENT, label: 'q' });

    expect(result).toMatchObject({ text: '# Answer', stopReason: AgentStopReason.FINAL_ANSWER, modelCalls: 3 });
    expect(result.sourcesRead).toEqual(['lab-4/Mutex.md', 'lab-4/Barriers.md']);
    expect(result.usage).toEqual({ inputTokens: 30, outputTokens: 6 });
    expect(received[1].outputs).toEqual([{ callId: 'c0-search_vault', output: 'hits for mutex' }]);
    expect(received.every((r) => r.allowTools)).toBe(true);
  });

  it('truncates long tool results to the budget', async () => {
    const { model, received } = scriptedModel([calls([AgentToolName.READ_DOCUMENT, { path: 'a.md' }]), final('ok')]);
    await new AgentRunner([read], BUDGET).run({ model, systemPrompt: 's', content: CONTENT, label: 'q' });
    expect(received[1].outputs[0].output.startsWith('x'.repeat(50))).toBe(true);
    expect(received[1].outputs[0].output).toContain('truncated');
  });

  it('stops at the tool-call budget and forces a final answer without tools', async () => {
    const { model, received } = scriptedModel([
      calls([AgentToolName.SEARCH_VAULT, { query: 'a' }], [AgentToolName.SEARCH_VAULT, { query: 'b' }]),
      calls([AgentToolName.SEARCH_VAULT, { query: 'c' }], [AgentToolName.SEARCH_VAULT, { query: 'd' }]),
      (allowTools) => final(allowTools ? 'unexpected' : 'forced answer'),
    ]);
    const result = await new AgentRunner([search], BUDGET).run({ model, systemPrompt: 's', content: CONTENT, label: 'q' });

    expect(result).toMatchObject({ text: 'forced answer', stopReason: AgentStopReason.STEP_LIMIT });
    expect(result.steps).toHaveLength(3);
    expect(received[2].allowTools).toBe(false);
    expect(received[2].outputs.map((o) => o.output)).toEqual(['hits for c', BUDGET_EXHAUSTED_NOTE]);
  });

  it('stops at the time budget', async () => {
    let now = 0;
    const slowSearch = tool(AgentToolName.SEARCH_VAULT, async () => { now += 70_000; return { content: 'slow', sources: [] }; });
    const { model, received } = scriptedModel([calls([AgentToolName.SEARCH_VAULT, { query: 'a' }]), final('in time')]);
    const result = await new AgentRunner([slowSearch], BUDGET, () => now).run({ model, systemPrompt: 's', content: CONTENT, label: 'q' });
    expect(result.stopReason).toBe(AgentStopReason.TIME_LIMIT);
    expect(received[1].allowTools).toBe(false);
  });

  it('reports tool problems to the model instead of failing', async () => {
    const broken = tool(AgentToolName.READ_DOCUMENT, async () => { throw new Error('db down'); });
    const { model, received } = scriptedModel([
      calls(['delete_everything', {}], [AgentToolName.SEARCH_VAULT, '{not json'], [AgentToolName.READ_DOCUMENT, { path: 'a.md' }]),
      final('answer anyway'),
    ]);
    const result = await new AgentRunner([search, broken], BUDGET).run({ model, systemPrompt: 's', content: CONTENT, label: 'q' });

    expect(result.text).toBe('answer anyway');
    const outputs = received[1].outputs.map((o) => o.output);
    expect(outputs[0]).toMatch(/Tool error: unknown tool "delete_everything"/);
    expect(outputs[1]).toMatch(/Tool error: .*JSON/);
    expect(outputs[2]).toBe('Tool error: db down');
    expect(result.steps.map((s) => s.error).every(Boolean)).toBe(true);
    expect(result.sourcesRead).toEqual([]);
  });

  it('throws when the model keeps calling tools after the budget (caller falls back)', async () => {
    const { model } = scriptedModel([
      calls([AgentToolName.SEARCH_VAULT, { query: 'a' }], [AgentToolName.SEARCH_VAULT, { query: 'b' }], [AgentToolName.SEARCH_VAULT, { query: 'c' }]),
      calls([AgentToolName.SEARCH_VAULT, { query: 'd' }]),
    ]);
    await expect(new AgentRunner([search], BUDGET).run({ model, systemPrompt: 's', content: CONTENT, label: 'q' }))
      .rejects.toThrow(/after the budget was exhausted/);
  });

  it('propagates model/transport errors', async () => {
    const model: ToolCallingModel = { model: 'm', startSession: () => ({ next: async () => { throw new Error('HTTP 500'); } }) };
    await expect(new AgentRunner([search], BUDGET).run({ model, systemPrompt: 's', content: CONTENT, label: 'q' })).rejects.toThrow('HTTP 500');
  });
});
