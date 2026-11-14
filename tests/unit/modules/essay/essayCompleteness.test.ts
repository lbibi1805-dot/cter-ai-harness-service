import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { AIProvider, AnswerEventType, FinishReason, type AIAnswer, type AIRequest, type AnswerStreamEvent, type PreparedPrompt } from '../../../../src/modules/ai';
import { PromptCacheLayout } from '../../../../src/modules/ai/domain/enums/promptLayout.enums';
import {
  DEFAULT_ESSAY_SETTINGS,
  ESSAY_VERB_EXPECTATIONS,
  EssayService,
  EssayTrigger,
  EssayVerb,
  essayOutputTokens,
  heuristicAnalysis,
  type EssayServiceDeps,
} from '../../../../src/modules/essay';
import { questionTargets } from '../../../../src/modules/essay/domain/helpers/essayAnalysis.helper';
import { parseVerbExpectations } from '../../../../src/modules/essay/application/helpers/essayPrompt.helper';
import { ESSAY_CONTINUE_FALLBACK } from '../../../../src/modules/essay/application/constants/essayContinue.constants';
import { createPromptRegistry } from '../../../../src/modules/prompts';
import type { CandidateReranker } from '../../../../src/modules/retrieval';

const ROOT = path.resolve(__dirname, '../../../..');
const registry = createPromptRegistry(path.join(ROOT, 'prompts'));

describe('Essay Mode completeness (12/11 plan 08 Bước 4)', () => {
  it('every "(N điểm)" counts: one target per numbered question', () => {
    expect(questionTargets('Câu 1 (2 điểm): Trình bày A.\nCâu 2 (3 điểm): Phân tích B.', 175)).toEqual([
      { label: 'Câu 1', points: 2, targetWords: 350 },
      { label: 'Câu 2', points: 3, targetWords: 525 },
    ]);
    expect(questionTargets('Trình bày A và phân tích B (2 điểm)', 175)).toEqual([]);
  });

  it('up to ESSAY_MAX_ASPECTS (12) aspects; the writing cap follows AI_MAX_OUTPUT_TOKENS instead of a fixed 8192', () => {
    const question = Array.from({ length: 10 }, (_, i) => `ý số ${i + 1} cần trình bày rõ`).join('; ');
    expect(heuristicAnalysis(question, 12).aspects).toHaveLength(10);
    expect(heuristicAnalysis(question, 6).aspects).toHaveLength(6);
    expect(essayOutputTokens(3000, 16_384)).toBeGreaterThan(8192);
    expect(essayOutputTokens(6000, 16_384)).toBe(16_384);
  });

  it('verb expectations come from prompts/skills/essay/verb-expectations.md (built-in copy identical); continue prompt copy identical', () => {
    const table = parseVerbExpectations(registry.skill('skill.essay.verb-expectations')?.body);
    for (const verb of Object.values(EssayVerb)) expect(table[verb]).toBe(ESSAY_VERB_EXPECTATIONS[verb]);
    expect(table[EssayVerb.LIST]).toContain('1–3 câu');
    expect(registry.skill('skill.answer.continue')?.body.trim()).toBe(ESSAY_CONTINUE_FALLBACK);
  });

  it('an unclosed <essay> is continued where it stopped; the client gets one essay and a continuation event', async () => {
    const replies = ['<outline>- A [c:none]</outline>\n<essay>Phần đầu của bài viết về kiểm thử hộp đen và', ' kiểm thử hộp đen và hộp trắng.</essay>'];
    const calls: { request: AIRequest; prompt: PreparedPrompt }[] = [];
    const noRerank: CandidateReranker = { enabled: false, candidateCount: (k) => k, wrap: (inner) => inner };
    const deps: EssayServiceDeps = {
      invocation: {
        answerPrepared: async (request, prompt) => {
          calls.push({ request, prompt });
          const text = replies[calls.length - 1];
          for (const piece of text.match(/[\s\S]{1,6}/g) ?? []) request.stream?.delta(piece);
          return { text, model: 'main', attempts: 1, contexts: [], ...(calls.length === 1 ? { finishReason: FinishReason.LENGTH } : { finishReason: FinishReason.STOP }) } satisfies AIAnswer;
        },
      },
      createRetriever: () => ({ retrieve: async () => [] }),
      reranker: noRerank,
      aux: null,
      registry,
      exemplars: null,
      systemPrompt: 'BASE',
      promptLayout: PromptCacheLayout.V2,
    };
    const service = new EssayService({ ...DEFAULT_ESSAY_SETTINGS, maxContinuations: 2 }, deps);
    let shown = '';
    const events: AnswerStreamEvent[] = [];
    const answer = await service.write({
      provider: AIProvider.GEMINI, model: 'main', label: 't',
      content: { textContent: 'Câu 1 (2 điểm): Trình bày kiểm thử hộp đen.\nCâu 2 (1 điểm): Nêu kiểm thử hộp trắng.', imageBuffers: [] },
      options: { trigger: EssayTrigger.COMMAND, strict: false },
      stream: { delta: (t) => { shown += t; }, reset: () => { shown = ''; }, event: (e) => events.push(e) },
    });
    expect(calls).toHaveLength(2);
    expect(calls[0].prompt.content.textContent).toContain('- Câu 1: 350');
    expect(calls[0].prompt.content.textContent).toContain('target_words: 525');
    expect(calls[1].prompt.content.history?.at(-1)?.text).toBe(replies[0]);
    expect(answer.text).toBe('Phần đầu của bài viết về kiểm thử hộp đen và hộp trắng.');
    expect(answer.timings?.llmCalls).toBe(2);
    expect(events).toEqual([{ type: AnswerEventType.CONTINUATION, n: 1 }]);
    expect(shown).toContain('Phần đầu của bài viết');
    expect(shown).not.toContain('<essay>');
  });
});
