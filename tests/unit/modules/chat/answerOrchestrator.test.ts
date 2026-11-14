import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { AIProvider, AnswerEventType, ConversationRole, FinishReason, type AnswerStreamEvent } from '../../../../src/modules/ai';
import { AnswerMode, type Answerer, type AnswerRequest, type AnswerResult } from '../../../../src/modules/agent/domain';
import {
  ANSWER_PROMPT_IDS,
  AnswerOrchestrator,
  DEFAULT_ANSWER_PROMPTS,
  answerPromptsFrom,
  buildAnswerPlan,
  checkCoverage,
  groupSections,
} from '../../../../src/modules/chat';
import { createPromptRegistry } from '../../../../src/modules/prompts';

const ROOT = path.resolve(__dirname, '../../../..');

/** One scripted model reply: streamed in small pieces, then returned (or thrown after streaming). */
interface Scripted {
  text: string;
  finishReason?: FinishReason;
  /** Throw after streaming `text` (a call that dies mid-answer). */
  failAfterStream?: boolean;
  outputTokens?: number;
}

/** Offline fake provider: records each request, answers from the script in order. */
function fakeAnswerer(script: Scripted[]): Answerer & { requests: AnswerRequest[] } {
  const requests: AnswerRequest[] = [];
  return {
    requests,
    async answer(request: AnswerRequest): Promise<AnswerResult> {
      requests.push(request);
      const reply = script[requests.length - 1] ?? { text: '(no more script)' };
      for (const piece of reply.text.match(/[\s\S]{1,9}/g) ?? []) request.stream?.delta(piece);
      if (reply.failAfterStream) throw new Error('stream broke');
      return {
        text: reply.text,
        model: `m${requests.length}`,
        attempts: 1,
        contexts: [{ chunkId: `c${requests.length % 2}`, text: 't', source: 's.md', heading: 'h', parentHeading: '', tokenCount: 1 }],
        timings: { totalMs: 1, attempts: [], outputTokens: reply.outputTokens ?? 100 },
        ...(reply.finishReason ? { finishReason: reply.finishReason } : {}),
      };
    },
  };
}

function client() {
  const events: AnswerStreamEvent[] = [];
  let shown = '';
  let resets = 0;
  return {
    events,
    text: () => shown,
    resets: () => resets,
    stream: {
      delta: (t: string) => { shown += t; },
      reset: () => { shown = ''; resets++; },
      event: (e: AnswerStreamEvent) => { events.push(e); },
    },
  };
}

function request(text: string, extra: Partial<AnswerRequest> = {}): AnswerRequest {
  return { provider: AIProvider.GEMINI, model: 'main', label: 't', content: { textContent: text, imageBuffers: [] }, ...extra };
}

const words = (n: number, word = 'nội dung') => Array.from({ length: n }, () => word).join(' ');

const THREE = 'Câu 1: Trình bày khái niệm hệ thời gian thực.\nCâu 2: Giải thích priority inversion.\nCâu 3: Phân tích ưu nhược điểm của RTOS.';

describe('answer plan (domain)', () => {
  it('targets: marks × 175, essay without marks 300, short not forced; 12 essays do not fit one call → sections of ≤ 3', () => {
    const plan = buildAnswerPlan('Câu 1 (2 điểm): Trình bày kiến trúc.\nCâu 2: Giải thích cơ chế cache.\nCâu 3: Định nghĩa API là gì?', { minWordsPerQuestion: 300, wordsPerPoint: 175 });
    expect(plan.questions.map((q) => q.targetWords)).toEqual([350, 300, undefined]);
    expect(groupSections(plan, { maxOutputTokens: 16_384, sectionMaxQuestions: 3 })).toHaveLength(1);
    const twelve = buildAnswerPlan(Array.from({ length: 12 }, (_, i) => `Câu ${i + 1}: Phân tích vấn đề số ${i + 1} của hệ thống.`).join('\n'), { minWordsPerQuestion: 300, wordsPerPoint: 175 });
    const sections = groupSections(twelve, { maxOutputTokens: 16_384, sectionMaxQuestions: 3 });
    expect(sections.map((s) => s.length)).toEqual([3, 3, 3, 3]);
  });

  it('coverage: a missing label or an answer under 60 % of its target is missing', () => {
    const plan = buildAnswerPlan(THREE, { minWordsPerQuestion: 100, wordsPerPoint: 175 });
    const text = `**Câu 1.** ${words(80)}\n\n**Câu 2.** ${words(20)}`;
    expect(checkCoverage(text, plan.questions).missing).toEqual(['Q2', 'Q3']);
    expect(checkCoverage(`${text} ${words(50)}\n\n### Câu 3\n${words(70)}`, plan.questions).missing).toEqual([]);
  });
});

describe('AnswerOrchestrator (offline, fake provider)', () => {
  it('one question, not cut: a single pass-through call, no events, no plan block', async () => {
    const inner = fakeAnswerer([{ text: 'Một câu trả lời.', finishReason: FinishReason.STOP }]);
    const c = client();
    const orchestrator = new AnswerOrchestrator(inner);
    const result = await orchestrator.answer(request('Mutex là gì?', { stream: c.stream }));
    expect(inner.requests).toHaveLength(1);
    expect(inner.requests[0].content.textContent).toBe('Mutex là gì?');
    expect(c.events).toEqual([]);
    expect(result.text).toBe('Một câu trả lời.');
    expect(result.completeness).toMatchObject({ questions: 1, sections: 1, continuations: 0, missing: [], truncated: false });
  });

  it('multi-question: <answer_plan> after the question, answer_plan + coverage events, RAG still searches the question', async () => {
    const answer = `**Câu 1.** ${words(300)}\n\n**Câu 2.** ${words(300)}\n\n**Câu 3.** ${words(300)}`;
    const inner = fakeAnswerer([{ text: answer, finishReason: FinishReason.STOP }]);
    const c = client();
    const result = await new AnswerOrchestrator(inner).answer(request(THREE, { stream: c.stream }));
    const sent = inner.requests[0].content;
    expect(sent.textContent.startsWith(THREE)).toBe(true);
    expect(sent.textContent).toContain('<answer_plan>');
    expect(sent.textContent).toContain('- **Câu 2.** — ~300 words');
    expect(sent.retrievalQuery).toBe(THREE);
    expect(c.events[0]).toEqual({ type: AnswerEventType.ANSWER_PLAN, total: 3, questions: [{ id: 'Q1', label: 'Câu 1' }, { id: 'Q2', label: 'Câu 2' }, { id: 'Q3', label: 'Câu 3' }] });
    expect(c.events.at(-1)).toEqual({ type: AnswerEventType.COVERAGE, missing: [] });
    expect(result.text).toBe(answer);
    expect(c.text()).toBe(answer);
  });

  it('cut by the output cap: continues in the same stream, drops the repeated tail, history carries the cut answer', async () => {
    const head = `Hệ thời gian thực là hệ thống phải đáp ứng deadline. ${words(10)} điều quan trọng nhất là`;
    const inner = fakeAnswerer([
      { text: head, finishReason: FinishReason.LENGTH },
      { text: 'điều quan trọng nhất là tính đúng hạn của kết quả.', finishReason: FinishReason.STOP },
    ]);
    const c = client();
    const result = await new AnswerOrchestrator(inner).answer(request('Trình bày khái niệm hệ thời gian thực.', { stream: c.stream, content: { textContent: 'Trình bày khái niệm hệ thời gian thực.', imageBuffers: [], history: [] } }));
    expect(inner.requests).toHaveLength(2);
    const cont = inner.requests[1];
    expect(cont.mode).toBe(AnswerMode.SINGLE_SHOT);
    expect(cont.content.textContent).toBe(DEFAULT_ANSWER_PROMPTS.continue);
    expect(cont.content.history?.map((t) => t.role)).toEqual([ConversationRole.USER, ConversationRole.ASSISTANT]);
    expect(cont.content.history?.[1].text).toBe(head);
    expect(result.text).toBe(`${head} tính đúng hạn của kết quả.`);
    expect(c.text()).toBe(result.text);
    expect(c.events).toEqual([{ type: AnswerEventType.CONTINUATION, n: 1 }]);
    expect(result.completeness).toMatchObject({ continuations: 1, truncated: false });
    expect(result.timings?.outputTokens).toBe(200);
  });

  it('stops after ANSWER_MAX_CONTINUATIONS and reports the answer as still truncated', async () => {
    const inner = fakeAnswerer(Array.from({ length: 5 }, (_, i) => ({ text: `phần ${i} của câu trả lời rất dài `, finishReason: FinishReason.LENGTH })));
    const orchestrator = new AnswerOrchestrator(inner, { maxContinuations: 2 });
    const result = await orchestrator.answer(request('Giải thích kiến trúc microservice.'));
    expect(inner.requests).toHaveLength(3);
    expect(result.completeness?.truncated).toBe(true);
    expect(orchestrator.metrics.summary()).toMatchObject({ turns: 1, continuationsTotal: 2, truncatedRemaining: 1, completeRate: 0 });
  });

  it('a call that dies after streaming text is continued from there instead of failing the turn', async () => {
    const inner = fakeAnswerer([
      { text: 'Priority inversion xảy ra khi tác vụ ưu tiên thấp giữ khoá', failAfterStream: true },
      { text: ' mà tác vụ ưu tiên cao cần.', finishReason: FinishReason.STOP },
    ]);
    const c = client();
    const result = await new AnswerOrchestrator(inner).answer(request('Giải thích priority inversion.', { stream: c.stream }));
    expect(result.text).toBe('Priority inversion xảy ra khi tác vụ ưu tiên thấp giữ khoá mà tác vụ ưu tiên cao cần.');
    expect(c.text()).toBe(result.text);
  });

  it('nothing written at all: the error reaches the caller as before', async () => {
    const failing: Answerer = { answer: async () => { throw new Error('all models down'); } };
    await expect(new AnswerOrchestrator(failing).answer(request(THREE))).rejects.toThrow('all models down');
  });

  it('12 essay questions → 4 sections streamed as one answer; section events; earlier parts are never re-sent', async () => {
    const question = Array.from({ length: 12 }, (_, i) => `Câu ${i + 1}: Phân tích vấn đề số ${i + 1} của hệ thống.`).join('\n');
    const part = (from: number) => [0, 1, 2].map((k) => `**Câu ${from + k}.** ${words(300)}`).join('\n\n');
    const inner = fakeAnswerer([1, 4, 7, 10].map((from) => ({ text: part(from), finishReason: FinishReason.STOP })));
    const c = client();
    const result = await new AnswerOrchestrator(inner).answer(request(question, { stream: c.stream }));
    expect(inner.requests).toHaveLength(4);
    expect(inner.requests[1].content.textContent).toContain('This is part 2 of 4');
    expect(inner.requests[1].content.textContent).toContain('Already written (do not write them again): Câu 1, Câu 2, Câu 3.');
    expect(inner.requests[1].content.history ?? []).toEqual([]);
    expect(c.events.filter((e) => e.type === AnswerEventType.SECTION)).toEqual([1, 2, 3, 4].map((index) => ({ type: AnswerEventType.SECTION, index, total: 4 })));
    expect(result.text).toBe([1, 4, 7, 10].map(part).join('\n\n'));
    expect(c.text()).toBe(result.text);
    expect(result.completeness).toMatchObject({ questions: 12, sections: 4, missing: [] });
  });

  it('a retry inside section 2 resets the client and replays section 1 (the client never loses earlier parts)', async () => {
    const question = Array.from({ length: 6 }, (_, i) => `Câu ${i + 1}: Phân tích vấn đề ${i + 1}.`).join('\n');
    const first = [1, 2, 3].map((n) => `**Câu ${n}.** ${words(300)}`).join('\n\n');
    const second = [4, 5, 6].map((n) => `**Câu ${n}.** ${words(300)}`).join('\n\n');
    let call = 0;
    const inner: Answerer = {
      answer: async (req) => {
        call++;
        if (call === 2) {
          req.stream?.delta('nửa chừng');
          req.stream?.reset();
        }
        const text = call === 1 ? first : second;
        req.stream?.delta(text);
        return { text, model: 'm', attempts: 1, contexts: [], finishReason: FinishReason.STOP };
      },
    };
    const c = client();
    const result = await new AnswerOrchestrator(inner, { maxOutputTokens: 8_000 }).answer(request(question, { stream: c.stream }));
    expect(c.resets()).toBe(1);
    expect(c.text()).toBe(`${first}\n\n${second}`);
    expect(result.text).toBe(c.text());
  });

  it('coverage fix: one extra call writes only the missing questions, appended after a blank line', async () => {
    const short = `**Câu 1.** ${words(300)}\n\n**Câu 2.** ${words(300)}`;
    const fix = `**Câu 3.** ${words(300)}`;
    const inner = fakeAnswerer([{ text: short, finishReason: FinishReason.STOP }, { text: fix, finishReason: FinishReason.STOP }]);
    const c = client();
    const orchestrator = new AnswerOrchestrator(inner);
    const result = await orchestrator.answer(request(THREE, { stream: c.stream }));
    expect(inner.requests[1].content.textContent).toContain('Câu 3 (~300 words)');
    expect(inner.requests[1].content.textContent).not.toContain('Câu 1 (');
    expect(result.text).toBe(`${short}\n\n${fix}`);
    expect(c.events.at(-1)).toEqual({ type: AnswerEventType.COVERAGE, missing: [] });
    expect(result.completeness).toMatchObject({ coverageFix: true, missing: [] });
    expect(orchestrator.metrics.summary()).toMatchObject({ turns: 1, questionsPerTurnAvg: 3, completeRate: 1, outputTokensAvg: 200 });
    expect(orchestrator.metrics.summary().longTurnP95Ms).not.toBeNull();
  });

  it('coverage still missing after the fix (or fix disabled) is reported in the coverage event', async () => {
    const inner = fakeAnswerer([{ text: `**Câu 1.** ${words(300)}`, finishReason: FinishReason.STOP }]);
    const c = client();
    const result = await new AnswerOrchestrator(inner, { coverageFix: false }).answer(request(THREE, { stream: c.stream }));
    expect(inner.requests).toHaveLength(1);
    expect(c.events.at(-1)).toEqual({ type: AnswerEventType.COVERAGE, missing: ['Q2', 'Q3'] });
    expect(result.completeness?.missing).toEqual(['Q2', 'Q3']);
  });

  it('agent mode: no sections, the first call keeps the agent mode, extra calls are single-shot', async () => {
    const inner = fakeAnswerer([{ text: `**Câu 1.** ${words(300)}`, finishReason: FinishReason.LENGTH }, { text: ` ${words(5)}\n\n**Câu 2.** ${words(300)}\n\n**Câu 3.** ${words(300)}`, finishReason: FinishReason.STOP }]);
    await new AnswerOrchestrator(inner).answer(request(THREE, { mode: AnswerMode.AGENT }));
    expect(inner.requests.map((r) => r.mode)).toEqual([AnswerMode.AGENT, AnswerMode.SINGLE_SHOT]);
  });

  it('ANSWER_COMPLETENESS_ENABLED=false passes the request through untouched', async () => {
    const inner = fakeAnswerer([{ text: 'x', finishReason: FinishReason.LENGTH }]);
    const req = request(THREE);
    await new AnswerOrchestrator(inner, { enabled: false }).answer(req);
    expect(inner.requests).toEqual([req]);
  });

  it('multi-question turns get the long deadline; extra calls get their own per-call deadline', async () => {
    let now = 1_000;
    const inner = fakeAnswerer([{ text: 'cut', finishReason: FinishReason.LENGTH }, { text: ' rest', finishReason: FinishReason.STOP }]);
    const orchestrator = new AnswerOrchestrator(inner, { coverageFix: false }, DEFAULT_ANSWER_PROMPTS, () => (now += 10));
    await orchestrator.answer(request(THREE));
    expect(inner.requests[0].deadlineAt).toBe(1_010 + 240_000);
    expect(inner.requests[1].deadlineAt).toBeLessThanOrEqual(1_010 + 240_000);
  });
});

describe('prompts/skills/answer/*.md are the source of every instruction', () => {
  const registry = createPromptRegistry(path.join(ROOT, 'prompts'));
  const skill = (id: string) => registry.skill(id)?.body ?? null;

  it('built-in copies are identical to the files', () => {
    expect(answerPromptsFrom(skill)).toEqual(DEFAULT_ANSWER_PROMPTS);
    for (const id of Object.values(ANSWER_PROMPT_IDS)) expect(skill(id)).not.toBeNull();
  });

  it('the static system prompt carries the answer-completeness policy and the same-language rule', () => {
    expect(registry.systemPrompt).toContain('ANSWER COMPLETENESS');
    expect(registry.systemPrompt).toContain('same language as the user');
    expect(registry.systemPrompt).not.toContain('Keep it concise');
    expect(registry.systemPrompt).not.toContain('Every sentence should earn its place');
  });
});
