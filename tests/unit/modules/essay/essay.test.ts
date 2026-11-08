import { describe, expect, it } from 'vitest';
import { AIProvider, type AIAnswer, type AIRequest, type PreparedPrompt } from '../../../../src/modules/ai';
import { PromptCacheLayout } from '../../../../src/modules/ai/domain/enums/promptLayout.enums';
import {
  DEFAULT_ESSAY_SETTINGS,
  EssayService,
  EssayStreamFilter,
  EssayTrigger,
  LLM_CALL_BUDGET,
  checkCitations,
  detectEssayQuestion,
  heuristicAnalysis,
  parseAnalysisReply,
  parseEssayCommand,
  scoreEssayCase,
  selectEssayChunks,
  splitEssayOutput,
  targetWordsFor,
  type EssayServiceDeps,
} from '../../../../src/modules/essay';
import { PromptRegistry } from '../../../../src/modules/prompts';
import type { CandidateReranker, CitedChunk } from '../../../../src/modules/retrieval';
import { toChatQuestion } from '../../../../src/modules/chat/presentation/mappers/chat.mapper';
import { AnswerMode } from '../../../../src/modules/agent/domain';

function chunk(id: string, source = 'software-tesing-ISYS2092/week1.md'): CitedChunk {
  return { chunkId: id, text: `text of ${id}`, source, heading: 'H', parentHeading: '', tokenCount: 10 };
}

describe('/essay command parsing', () => {
  it.each([
    ['/essay So sánh A và B', { question: 'So sánh A và B', strict: false }],
    ['/essay strict So sánh A', { question: 'So sánh A', strict: true }],
    ['/essay 3đ Trình bày X', { question: 'Trình bày X', strict: false, points: 3 }],
    ['/essay strict 2,5d Trình bày X', { question: 'Trình bày X', strict: true, points: 2.5 }],
    ['  /ESSAY   3 điểm? no', { question: '3 điểm? no', strict: false }],
    ['/essay', { question: '', strict: false }],
  ])('%j', (input, expected) => {
    expect(parseEssayCommand(input)).toEqual(expected);
  });

  it('ignores non-commands', () => {
    expect(parseEssayCommand('/essayx abc')).toBeNull();
    expect(parseEssayCommand('write an /essay')).toBeNull();
  });

  it('maps /essay and mode "essay" in the chat body (agent never combined)', () => {
    const fromCommand = toChatQuestion({ provider: 'gemini', question: '/essay strict 2đ Trình bày A', mode: 'agent' });
    expect(fromCommand.content.textContent).toBe('Trình bày A');
    expect(fromCommand.mode).toBe(AnswerMode.SINGLE_SHOT);
    expect(fromCommand.essay).toEqual({ trigger: EssayTrigger.COMMAND, strict: true, points: 2 });
    const fromMode = toChatQuestion({ provider: 'gemini', question: 'Trình bày A', mode: 'essay' });
    expect(fromMode.essay).toEqual({ trigger: EssayTrigger.BODY_MODE, strict: false });
    expect(toChatQuestion({ provider: 'gemini', question: 'hi' }).essay).toBeUndefined();
    expect(() => toChatQuestion({ provider: 'gemini', question: '/essay strict' })).toThrow(/essay question/);
  });
});

describe('auto detector (conservative)', () => {
  it('needs both an exam verb and stated marks', () => {
    expect(detectEssayQuestion('Trình bày quy trình kiểm thử hộp đen trong dự án phần mềm (2 điểm)')).toBe(true);
    expect(detectEssayQuestion('Trình bày quy trình kiểm thử hộp đen trong dự án phần mềm')).toBe(false);
    expect(detectEssayQuestion('Điểm thi của tôi là bao nhiêu (2 điểm) vậy bạn ơi?')).toBe(false);
    expect(detectEssayQuestion('Nêu X (2đ)')).toBe(false);
  });
});

describe('analysis', () => {
  it('(2 điểm) → 350 target words', () => {
    const analysis = heuristicAnalysis('Trình bày khái niệm kiểm thử phần mềm (2 điểm)');
    expect(analysis.points).toBe(2);
    expect(targetWordsFor(analysis.points, undefined, DEFAULT_ESSAY_SETTINGS.wordsPerPoint)).toBe(350);
  });

  it('heuristic splits list separators and long "và" halves, keeps "So sánh A và B" whole', () => {
    expect(heuristicAnalysis('Định nghĩa black-box testing, định nghĩa white-box testing; nêu ưu nhược điểm và cho ví dụ cụ thể của từng loại').aspects)
      .toEqual(['Định nghĩa black-box testing', 'định nghĩa white-box testing', 'nêu ưu nhược điểm', 'cho ví dụ cụ thể của từng loại']);
    expect(heuristicAnalysis('So sánh black-box và white-box testing').aspects).toEqual(['So sánh black-box và white-box testing']);
  });

  it('parses the aux JSON (fenced) and rejects unusable replies', () => {
    const parsed = parseAnalysisReply('```json\n{"subject":"Testing","aspects":["a","b"],"verbs":["compare","bogus"],"points":3,"targetWords":null}\n```', 'q');
    expect(parsed).toMatchObject({ subject: 'Testing', aspects: ['a', 'b'], verbs: ['compare'], points: 3, fromModel: true });
    expect(parseAnalysisReply('no json', 'q')).toBeNull();
    expect(parseAnalysisReply('{"aspects": []}', 'q')).toBeNull();
  });
});

describe('selectEssayChunks', () => {
  it('guarantees ≥2 chunks per aspect within the budget, then follows the ranking', () => {
    const ranked = ['a1', 'a2', 'a3', 'b1', 'c1', 'c2'].map((id) => chunk(id));
    const lists = [[chunk('a1'), chunk('a2'), chunk('a3')], [chunk('b1'), chunk('b2')], [chunk('c1'), chunk('c2')]];
    const { chunks, coverage } = selectEssayChunks(ranked, lists, 2, 6);
    expect(chunks.map((c) => c.chunkId).sort()).toEqual(['a1', 'a2', 'b1', 'b2', 'c1', 'c2']);
    expect(coverage).toBe(1);
  });

  it('a tight budget still gives every aspect one chunk first', () => {
    const lists = [[chunk('a1'), chunk('a2')], [chunk('b1')], [chunk('c1')]];
    expect(selectEssayChunks(lists.flat(), lists, 2, 3).chunks.map((c) => c.chunkId).sort()).toEqual(['a1', 'b1', 'c1']);
  });
});

describe('output parsing and citations', () => {
  it('splits outline and essay and flags fabricated ids', () => {
    const { outline, essay } = splitEssayOutput('<outline>- x [c:a#1#000]\n- y [c:fake#9#999, c:a#1#000]\n- z [c:none]</outline>\n<essay>Body</essay>');
    expect(essay).toBe('Body');
    expect(checkCitations(outline, new Set(['a#1#000']))).toEqual({ valid: ['a#1#000'], unknown: ['fake#9#999'] });
  });

  it('stream filter drops the outline and the closing tag, across split deltas', () => {
    const filter = new EssayStreamFilter();
    const out = ['<outli', 'ne>- claim [c:a]</outline>\n<es', 'say>\nHello ', 'world</es', 'say>trailing'].map((d) => filter.push(d)).join('');
    expect(out).toBe('Hello world');
    expect(filter.emitted()).toBe(true);
  });
});

describe('EssayService (fakes)', () => {
  const question = 'Định nghĩa black-box testing, định nghĩa white-box testing; nêu ưu nhược điểm (2 điểm)';
  const byQuery: Record<string, CitedChunk[]> = {
    'Định nghĩa black-box testing': [chunk('bb#1#000'), chunk('bb#1#001')],
    'định nghĩa white-box testing': [chunk('wb#1#000'), chunk('wb#1#001')],
    'nêu ưu nhược điểm': [chunk('pc#1#000'), chunk('pc#1#001')],
  };
  const noRerank: CandidateReranker = { enabled: false, candidateCount: (k) => k, wrap: (inner) => inner };

  function build(reply: string, opts: { aux?: boolean; auxReply?: string; registry?: PromptRegistry | null } = {}) {
    const calls: { request: AIRequest; prompt: PreparedPrompt }[] = [];
    const deps: EssayServiceDeps = {
      invocation: {
        answerPrepared: async (request, prompt) => {
          calls.push({ request, prompt });
          const text = request.purpose === 'essay' ? reply : opts.auxReply ?? 'not json';
          if (request.stream) for (const piece of text.match(/[\s\S]{1,7}/g) ?? []) request.stream.delta(piece);
          return { text, model: request.model, attempts: 1, contexts: [], timings: { totalMs: 1, attempts: [] } } satisfies AIAnswer;
        },
      },
      createRetriever: () => ({ retrieve: async (q: string) => byQuery[q] ?? [chunk('q#1#000')] }),
      reranker: noRerank,
      aux: opts.aux === false ? null : { provider: AIProvider.GEMINI, model: 'aux' },
      registry: opts.registry ?? null,
      exemplars: null,
      systemPrompt: 'BASE',
      promptLayout: PromptCacheLayout.V2,
    };
    return { service: new EssayService(DEFAULT_ESSAY_SETTINGS, deps), calls };
  }

  const reply = '<outline>- BB [c:bb#1#000]\n- WB [c:wb#1#000]\n- fake [c:zz#0#000]</outline>\n<essay>Black-box là kiểm thử dựa trên đặc tả [c:bb#1#000]. White-box dựa trên mã.</essay>';

  it('3-aspect question → coverage 100%, 350 words target, fabricated id dropped, ≤3 LLM calls, only the essay streamed', async () => {
    const { service, calls } = build(reply);
    const deltas: string[] = [];
    const answer = await service.write({
      provider: AIProvider.GEMINI, model: 'main', label: 't',
      content: { textContent: question, imageBuffers: [] },
      options: { trigger: EssayTrigger.COMMAND, strict: true },
      stream: { delta: (t) => deltas.push(t), reset: () => deltas.splice(0) },
    });
    expect(answer.essay.aspects).toHaveLength(3);
    expect(answer.essay.coverage).toBe(1);
    expect(answer.essay.targetWords).toBe(350);
    expect(answer.essay.droppedCitations).toBe(1);
    expect(answer.essay.outline).not.toContain('zz#0#000');
    expect(answer.contexts.map((c) => c.chunkId)).toEqual(['bb#1#000', 'wb#1#000']);
    expect(answer.text).toBe('Black-box là kiểm thử dựa trên đặc tả. White-box dựa trên mã.');
    expect(deltas.join('')).not.toContain('<outline>');
    expect(deltas.join('')).not.toContain('BB [c:');
    // analysis (aux, unusable → heuristic) + writing + strict self-check
    expect(calls).toHaveLength(3);
    expect(answer.timings?.llmCalls).toBe(3);
    expect(answer.timings!.llmCalls!).toBeLessThanOrEqual(LLM_CALL_BUDGET);
    const write = calls.find((c) => c.request.purpose === 'essay')!;
    expect(write.request.thinkingLevel).toBe(DEFAULT_ESSAY_SETTINGS.thinkingLevel);
    expect(write.request.maxOutputTokens).toBeGreaterThan(350);
    expect(write.prompt.content.textContent).toContain('[c:bb#1#000]');
    expect(write.prompt.content.textContent).toContain('target_words: 350');
  });

  it('strict self-check revises once: the revised essay replaces the streamed one', async () => {
    const { service } = build(reply, { auxReply: '<essay>Bản đã sửa.</essay>' });
    const deltas: string[] = [];
    const answer = await service.write({
      provider: AIProvider.GEMINI, model: 'main', label: 't', content: { textContent: question, imageBuffers: [] },
      options: { trigger: EssayTrigger.COMMAND, strict: true },
      stream: { delta: (t) => deltas.push(t), reset: () => deltas.splice(0) },
    });
    expect(answer.text).toBe('Bản đã sửa.');
    expect(deltas.join('')).toBe('Bản đã sửa.');
  });

  it('without aux: one LLM call (heuristic analysis, no self-check)', async () => {
    const { service, calls } = build(reply, { aux: false });
    const answer = await service.write({ provider: AIProvider.GEMINI, model: 'main', label: 't', content: { textContent: question, imageBuffers: [] }, options: { trigger: EssayTrigger.BODY_MODE, strict: true } });
    expect(calls).toHaveLength(1);
    expect(answer.timings?.llmCalls).toBe(1);
  });

  it('uses the domain <essay_rubric> chosen from the retrieved sources', async () => {
    const fm = (id: string, extra = '') => `---\nid: ${id}\nversion: 1\nowner: t\ndescription: d\n${extra}---\n`;
    const registry = new PromptRegistry([
      { path: 'core/system.md', content: `${fm('core.system')}CORE` },
      { path: 'domains/software-testing.md', content: `${fm('domain.software-testing', 'static: true\nmatch:\n  - "software-tes*ing-*"\n')}DOMAIN\n\n<essay_rubric>\nTESTING RUBRIC\n</essay_rubric>` },
    ]);
    expect(registry.systemPrompt).toBe('CORE\n\nDOMAIN');
    const { service, calls } = build(reply, { aux: false, registry });
    const answer = await service.write({ provider: AIProvider.GEMINI, model: 'main', label: 't', content: { textContent: question, imageBuffers: [] }, options: { trigger: EssayTrigger.COMMAND, strict: false } });
    expect(calls[0].prompt.content.textContent).toContain('TESTING RUBRIC');
    expect(answer.essay.domain).toBe('domain.software-testing');
  });
});

describe('golden essay rule score', () => {
  it('checks terms, length and citation validity', () => {
    const words = Array.from({ length: 340 }, () => 'deadline').join(' ');
    const score = scoreEssayCase(
      { id: 'E', question: 'q', aspects: ['a'], must_terms: ['deadline', 'hard|cứng'], target_words: 350, must_cite: ['Week-01'] },
      { text: words, sources: [{ file: 'Week-01/a.md' }], essay: { outline: '- x [c:a#1#000]', coverage: 1, droppedCitations: 0 }, trace: { contexts: [{ chunkId: 'a#1#000' }] } },
    );
    expect(score).toMatchObject({ missingTerms: ['hard|cứng'], lengthOk: true, citationsValid: true, missingCitations: [] });
    expect(score.score).toBeCloseTo(0.8);
  });
});
