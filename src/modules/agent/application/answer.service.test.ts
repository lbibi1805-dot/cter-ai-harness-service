import { describe, it, expect, vi } from 'vitest';
import type { AIInvocationService } from '../../ai';
import { AgentFallbackReason, AgentStopReason, AnswerMode, ModelTurnKind, type ToolCallingModel } from '../domain';
import { AgentRunner } from './agentRunner.service';
import { AnswerService } from './answer.service';

const REQUEST = { provider: 'openai' as const, model: 'gpt-6-astra', content: { textContent: 'Q?', imageBuffers: [] }, label: 'q' };

function singleShot() {
  return { answer: vi.fn(async () => ({ text: 'single-shot text', model: 'gpt-6-astra', attempts: 1 })) };
}

function agentModel(behaviour: 'answer' | 'fail'): ToolCallingModel {
  return {
    model: 'gpt-6-astra',
    startSession: () => ({
      next: async () => {
        if (behaviour === 'fail') throw new Error('HTTP 500');
        return { kind: ModelTurnKind.FINAL, text: 'agent text', usage: { inputTokens: 5, outputTokens: 1 } };
      },
    }),
  };
}

function service(ai = singleShot(), behaviour: 'answer' | 'fail' = 'answer', supported = true) {
  const createModel = vi.fn((provider: string) => (supported && provider === 'openai' ? agentModel(behaviour) : null));
  const svc = new AnswerService(ai as unknown as AIInvocationService, {
    runner: new AgentRunner([], { maxToolCalls: 3, maxDurationMs: 10_000, maxToolResultChars: 100 }),
    createModel,
    systemPrompt: 'agent system',
  });
  return { svc, ai, createModel };
}

describe('AnswerService', () => {
  it('uses single-shot unless agent mode is requested', async () => {
    const { svc, ai, createModel } = service();
    await expect(svc.answer(REQUEST)).resolves.toMatchObject({ text: 'single-shot text', mode: AnswerMode.SINGLE_SHOT });
    await svc.answer({ ...REQUEST, mode: AnswerMode.SINGLE_SHOT });
    expect(ai.answer).toHaveBeenCalledTimes(2);
    expect(createModel).not.toHaveBeenCalled();
  });

  it('answers with the agent when requested and supported', async () => {
    const { svc, ai } = service();
    const result = await svc.answer({ ...REQUEST, mode: AnswerMode.AGENT });
    expect(result).toMatchObject({
      text: 'agent text',
      mode: AnswerMode.AGENT,
      agent: { stopReason: AgentStopReason.FINAL_ANSWER, toolCalls: 0, sourcesRead: [], usage: { inputTokens: 5, outputTokens: 1 } },
    });
    expect(ai.answer).not.toHaveBeenCalled();
  });

  it.each([
    ['provider without tool calling', { ...REQUEST, provider: 'gemini' as const }, true, AgentFallbackReason.UNSUPPORTED_PROVIDER],
    ['OpenAI model outside Responses mode', REQUEST, false, AgentFallbackReason.UNSUPPORTED_MODEL],
  ])('falls back for a %s', async (_label, request, supported, reason) => {
    const { svc, ai } = service(singleShot(), 'answer', supported);
    const result = await svc.answer({ ...request, mode: AnswerMode.AGENT });
    expect(result).toMatchObject({ text: 'single-shot text', mode: AnswerMode.SINGLE_SHOT, fallbackReason: reason });
    expect(ai.answer).toHaveBeenCalledTimes(1);
  });

  it('falls back when the agent run fails, so the answer is never lost', async () => {
    const { svc } = service(singleShot(), 'fail');
    await expect(svc.answer({ ...REQUEST, mode: AnswerMode.AGENT }))
      .resolves.toMatchObject({ text: 'single-shot text', fallbackReason: AgentFallbackReason.AGENT_FAILED });
  });

  it('falls back when agent mode is disabled (no OpenAI key / vault)', async () => {
    const ai = singleShot();
    const svc = new AnswerService(ai as unknown as AIInvocationService, null);
    await expect(svc.answer({ ...REQUEST, mode: AnswerMode.AGENT }))
      .resolves.toMatchObject({ fallbackReason: AgentFallbackReason.AGENT_DISABLED });
  });

  it('propagates single-shot errors (the job turns them into an error PDF)', async () => {
    const ai = { answer: vi.fn().mockRejectedValue(new Error('all models failed')) };
    const { svc } = service(ai as never, 'fail');
    await expect(svc.answer({ ...REQUEST, mode: AnswerMode.AGENT })).rejects.toThrow('all models failed');
  });
});
