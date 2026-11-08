import { describe, expect, it } from 'vitest';
import { ChatService } from '../../../../../src/modules/chat';
import type { EssayWriter } from '../../../../../src/modules/chat/application/interfaces/chat.interface';
import type { ChatTurnOutcome, ChatTurns } from '../../../../../src/modules/chat';
import { toChatAnswerDto, toChatQuestion } from '../../../../../src/modules/chat/presentation/mappers/chat.mapper';
import { ModelCatalog } from '../../../../../src/modules/ai';
import { EssayTrigger, type EssayRequest } from '../../../../../src/modules/essay';
import type { Answerer } from '../../../../../src/modules/agent/domain';
import { buildTestAiConfig } from '../../../../support/configFixture';

const essayDetails = { outline: '- a [c:x#1#000]', aspects: ['a'], targetWords: 350, coverage: 1, strict: false, wordCount: 3, droppedCitations: 0, trigger: EssayTrigger.COMMAND };

function setup(autoDetect = false) {
  const requests: EssayRequest[] = [];
  const outcomes: ChatTurnOutcome[] = [];
  let normalCalls = 0;
  const answers: Answerer = { answer: async (request) => { normalCalls++; return { text: 'normal', model: request.model, attempts: 1, contexts: [] }; } };
  const essay: EssayWriter = {
    autoDetect,
    write: async (request) => {
      requests.push(request);
      return { text: 'the essay', model: request.model, attempts: 1, contexts: [], timings: { totalMs: 1, attempts: [], llmCalls: 2 }, essay: essayDetails };
    },
  };
  const turns: ChatTurns = {
    begin: async (input) => ({
      conversationId: 'conv',
      content: { textContent: input.question, imageBuffers: [] },
      finish: async (outcome) => { outcomes.push(outcome); return { conversationId: 'conv', messageId: 'm', persisted: true }; },
    }),
  };
  const service = new ChatService(answers, new ModelCatalog(buildTestAiConfig()), { enabled: true, agentEnabled: true, isProviderConfigured: () => true, turns, essay });
  return { service, requests, outcomes, normal: () => normalCalls };
}

describe('ChatService Essay Mode', () => {
  it('routes /essay to the essay pipeline, records the turn as essay and returns the essay DTO', async () => {
    const { service, requests, outcomes, normal } = setup();
    const answer = await service.ask(toChatQuestion({ provider: 'gemini', question: '/essay 2đ Trình bày A' }));
    expect(normal()).toBe(0);
    expect(requests[0].content.textContent).toBe('Trình bày A');
    expect(requests[0].options).toEqual({ trigger: EssayTrigger.COMMAND, strict: false, points: 2 });
    expect(outcomes[0]).toMatchObject({ text: 'the essay', mode: 'essay' });
    const dto = toChatAnswerDto(answer);
    expect(dto.text).toBe('the essay');
    expect(dto.essay).toEqual(essayDetails);
    expect(dto.timings?.llmCalls).toBe(2);
  });

  it('auto-detects only when ESSAY_MODE_ENABLED', async () => {
    const q = 'Trình bày quy trình kiểm thử hộp đen trong dự án phần mềm (2 điểm)';
    const off = setup(false);
    await off.service.ask(toChatQuestion({ provider: 'gemini', question: q }));
    expect(off.normal()).toBe(1);
    const on = setup(true);
    await on.service.ask(toChatQuestion({ provider: 'gemini', question: q }));
    expect(on.requests[0].options.trigger).toBe(EssayTrigger.AUTO);
  });

  it('a normal question keeps the normal path and no essay field', async () => {
    const { service, normal } = setup(true);
    const dto = toChatAnswerDto(await service.ask(toChatQuestion({ provider: 'gemini', question: 'QNX là gì?' })));
    expect(normal()).toBe(1);
    expect(dto.essay).toBeUndefined();
  });
});
