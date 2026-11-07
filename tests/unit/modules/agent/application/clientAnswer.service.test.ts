import { describe, it, expect, vi } from 'vitest';
import { AnswerMode, type Answerer } from '../../../../../src/modules/agent/domain';
import { ClientAnswerService } from '../../../../../src/modules/agent/application/clientAnswer.service';
import { AIProvider } from '../../../../../src/modules/ai';

describe('ClientAnswerService', () => {
  it('normalizes the final text, passes stream deltas through raw and keeps the other fields', async () => {
    const deltas: string[] = [];
    const inner: Answerer = {
      answer: vi.fn(async (request) => {
        request.stream?.delta('\\(a\\)');
        return { text: 'Giá $5, \\(a\\) và `\\(b\\)`', model: 'm', attempts: 2, mode: AnswerMode.AGENT, contexts: [] };
      }),
    };
    const result = await new ClientAnswerService(inner).answer({
      provider: AIProvider.GEMINI,
      model: 'm',
      label: 'l',
      content: { textContent: 'q', imageBuffers: [] },
      stream: { delta: (text) => deltas.push(text), reset: () => undefined },
    });
    expect(deltas).toEqual(['\\(a\\)']);
    expect(result).toEqual({ text: 'Giá $5, $a$ và `\\(b\\)`', model: 'm', attempts: 2, mode: AnswerMode.AGENT, contexts: [] });
  });
});
