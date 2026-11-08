import { describe, it, expect, vi } from 'vitest';
import { AIProvider, AttemptOutcome, type AIInvocationService, type AIRequest } from '../../../../../src/modules/ai';
import {
  AGENT_FALLBACK_MIN_MS,
  AgentFallbackReason,
  AgentToolName,
  AnswerMode,
  ModelTurnKind,
  type AgentTool,
  type ModelTurn,
  type ToolCallingModel,
  type ToolOutput,
} from '../../../../../src/modules/agent/domain';
import { AgentRunner } from '../../../../../src/modules/agent/application/agentRunner.service';
import { AnswerService } from '../../../../../src/modules/agent/application/answer.service';

const USAGE = { inputTokens: 10, outputTokens: 2 };
const REQUEST = { provider: AIProvider.OPENAI, model: 'gpt-6-astra', content: { textContent: 'Q?', imageBuffers: [] }, label: 'q', mode: AnswerMode.AGENT };

function scriptedModel(turns: Array<ModelTurn | Error>, onTurn: () => void = () => undefined) {
  const received: ToolOutput[][] = [];
  const model: ToolCallingModel = {
    model: 'gpt-6-astra',
    startSession: () => ({
      next: async (outputs) => {
        received.push(outputs);
        onTurn();
        const turn = turns.shift();
        if (!turn) throw new Error('script exhausted');
        if (turn instanceof Error) throw turn;
        return turn;
      },
    }),
  };
  return { model, received };
}

const searchCalls = (...queries: string[]): ModelTurn => ({
  kind: ModelTurnKind.TOOL_CALLS,
  calls: queries.map((query, i) => ({ id: `c${i}`, name: AgentToolName.SEARCH_VAULT, arguments: JSON.stringify({ query }) })),
  usage: USAGE,
});

describe('AgentRunner — parallel tool calls', () => {
  it('runs the search_vault calls of one turn concurrently and keeps their order', async () => {
    let running = 0;
    let peak = 0;
    const search: AgentTool = {
      name: AgentToolName.SEARCH_VAULT,
      description: '',
      parameters: {},
      execute: async (args) => {
        running++;
        peak = Math.max(peak, running);
        await new Promise((resolve) => setTimeout(resolve, args.query === 'a' ? 30 : 5));
        running--;
        return { content: `hits ${String(args.query)}`, sources: [`${String(args.query)}.md`] };
      },
    };
    const { model, received } = scriptedModel([searchCalls('a', 'b', 'c'), { kind: ModelTurnKind.FINAL, text: 'done', usage: USAGE }]);
    const result = await new AgentRunner([search], { maxToolCalls: 6, minToolCalls: 0, maxDurationMs: 60_000, maxToolResultChars: 100 })
      .run({ model, systemPrompt: 's', content: REQUEST.content, label: 'q' });
    expect(peak).toBe(3);
    expect(received[1].map((o) => o.output)).toEqual(['hits a', 'hits b', 'hits c']);
    expect(result.steps.map((s) => s.index)).toEqual([1, 2, 3]);
    expect(result.sourcesRead).toEqual(['a.md', 'b.md', 'c.md']);
  });
});

describe('AnswerService — deadline-aware fallback', () => {
  function build(now: () => number, agentTurns: Array<ModelTurn | Error>, onTurn?: () => void) {
    const seen: AIRequest[] = [];
    const singleShot = {
      deadlineMs: 90_000,
      answer: vi.fn(async (request: AIRequest) => {
        seen.push(request);
        return { text: 'single', model: 'gpt-6-astra', attempts: 1, contexts: [] };
      }),
    };
    const { model } = scriptedModel(agentTurns, onTurn);
    const svc = new AnswerService(singleShot as unknown as AIInvocationService, {
      runner: new AgentRunner([], { maxToolCalls: 3, minToolCalls: 0, maxDurationMs: 180_000, maxToolResultChars: 100 }, now),
      createModel: async () => ({ supported: true, model }),
      systemPrompt: 'agent',
    }, now);
    return { svc, seen };
  }

  it('gives the single-shot fallback only what is left of the request deadline', async () => {
    let now = 1_000_000;
    const { svc, seen } = build(() => now, [new Error('HTTP 500')], () => { now += 100_000; });
    const result = await svc.answer(REQUEST);
    expect(result).toMatchObject({ mode: AnswerMode.SINGLE_SHOT, fallbackReason: AgentFallbackReason.AGENT_FAILED });
    // max(agent 180 s, chat 90 s) from the start; 100 s already spent.
    expect(seen[0].deadlineAt).toBe(1_000_000 + 180_000);
  });

  it('never leaves the fallback less than AGENT_FALLBACK_MIN_MS', async () => {
    let now = 0;
    const { svc, seen } = build(() => now, [new Error('HTTP 500')], () => { now += 179_000; });
    await svc.answer(REQUEST);
    expect(seen[0].deadlineAt).toBe(179_000 + AGENT_FALLBACK_MIN_MS);
  });

  it('reports best-effort timings for an agent answer', async () => {
    const { svc } = build(() => 0, [{ kind: ModelTurnKind.FINAL, text: 'agent', usage: USAGE }]);
    const result = await svc.answer(REQUEST);
    expect(result.timings).toMatchObject({ inputTokens: 10, outputTokens: 2, attempts: [{ model: 'gpt-6-astra', outcome: AttemptOutcome.OK }] });
  });
});
