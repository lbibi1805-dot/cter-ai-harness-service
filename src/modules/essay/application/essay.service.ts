import { errorMessage } from '../../../shared/errors';
import { logger } from '../../../shared/logging/logger';
import { attempt } from '../../../shared/resilience/attempt';
import { withTimeout } from '../../../shared/resilience/withTimeout';
import { AnswerEventType, ConversationRole, FinishReason, type AIAnswer, type AnswerStream, type PromptContent } from '../../ai';
import { continuationTail } from '../../../shared/text';
import { placeMemory, withReminder } from '../../ai/domain/helpers/promptLayers.helper';
import { reciprocalRankFusion, type CitedChunk } from '../../retrieval';
import {
  ANALYSIS_MAX_OUTPUT_TOKENS,
  ANALYSIS_SYSTEM_PROMPT,
  DEFAULT_ESSAY_RUBRIC,
  DEFAULT_ESSAY_WRITER,
  DOMAIN_ID_PREFIX,
  ESSAY_BLOCK,
  ESSAY_CLOSE,
  ESSAY_CONTINUE_SKILL_ID,
  ESSAY_OPEN,
  ESSAY_VERB_SKILL_ID,
  MAX_ESSAY_ASPECTS,
  MAX_ESSAY_OUTPUT_TOKENS,
  MAX_TARGET_WORDS,
  ESSAY_MIN_CHUNKS_PER_ASPECT,
  ESSAY_PER_QUERY_TOP_K,
  ESSAY_RERANK_LABEL,
  ESSAY_RUBRIC_SKILL_ID,
  ESSAY_WRITER_SKILL_ID,
  EXEMPLAR_FOLDER,
  PROMPT_FILE_SUFFIX,
  SELF_CHECK_OK,
  SELF_CHECK_SYSTEM_PROMPT,
} from '../domain/constants/essay.constants';
import { EssayCallPurpose } from '../domain/enums/essay.enums';
import { essayOutputTokens, heuristicAnalysis, parseAnalysisObject, parseAnalysisReply, questionTargets, targetWordsFor } from '../domain/helpers/essayAnalysis.helper';
import {
  EssayStreamFilter,
  checkCitations,
  countWords,
  dropUnknownCitations,
  splitEssayOutput,
  stripCitationMarkers,
} from '../domain/helpers/essayOutput.helper';
import { selectEssayChunks } from '../domain/helpers/essaySelection.helper';
import type { EssayAnalysis, EssaySettings } from '../domain/interfaces/essay.interface';
import { buildEssayUserContent, buildSelfCheckInput, parseVerbExpectations, verbExpectationLines } from './helpers/essayPrompt.helper';
import { ESSAY_CONTINUE_FALLBACK } from './constants/essayContinue.constants';
import type { EssayAnswer, EssayRequest, EssayRubricChoice, EssayServiceDeps } from './interfaces/essayService.interface';

/**
 * Essay Mode (15 §2): ① analysis (the request's shared router aux call; own aux call only when that failed; heuristic fallback) → ②–④ one hybrid query per aspect plus the
 * question, RRF, rerank, ≥2 chunks per aspect within ESSAY_MAX_CHUNKS → ⑤⑥ ONE main-model call writing
 * `<outline>` (claims cite `[c:<chunkId>]`) then `<essay>` with the course rubric → ⑦ optional aux
 * self-check with one revise. At most 3 LLM calls. Only the `<essay>` part is streamed.
 */
export class EssayService {
  private readonly now: () => number;

  constructor(
    private readonly settings: EssaySettings,
    private readonly deps: EssayServiceDeps,
  ) {
    this.now = deps.now ?? Date.now;
  }

  get autoDetect(): boolean {
    return this.settings.autoDetect;
  }

  async write(request: EssayRequest): Promise<EssayAnswer> {
    const startedAt = this.now();
    const question = request.content.textContent.trim();
    let llmCalls = 0;

    // ① Analysis: the request's shared aux call (router) when given, else our own aux call; heuristic fallback.
    const analysed = await this.analysis(request, question);
    llmCalls += analysed.calls;
    const analysis = analysed.analysis ?? heuristicAnalysis(question, this.maxAspects);
    const points = request.options.points ?? analysis.points;
    // 08 Bước 4: several questions with their own "(N điểm)" → one target each, summed (an explicit `/essay 3đ` wins).
    const perQuestion = request.options.points === undefined ? questionTargets(question, this.settings.wordsPerPoint) : [];
    const targetWords = perQuestion.length
      ? Math.min(MAX_TARGET_WORDS, perQuestion.reduce((sum, q) => sum + q.targetWords, 0))
      : targetWordsFor(points, analysis.targetWords, this.settings.wordsPerPoint);

    // ②–④ Retrieval
    const retrievalStarted = this.now();
    const query = request.content.retrievalQuery?.trim() || question;
    const lists = await Promise.all([query, ...analysis.aspects].map((q) => this.search(q)));
    const ranked = await this.rerank(question, reciprocalRankFusion(lists));
    const selection = selectEssayChunks(ranked, lists.slice(1), ESSAY_MIN_CHUNKS_PER_ASPECT, this.settings.maxChunks);
    const retrievalMs = this.now() - retrievalStarted;

    // ⑤⑥ Outline + essay in one call
    const { rubric, domain } = this.rubricFor(selection.chunks);
    const exemplar = domain ? await this.exemplarFor(domain.path, question) : null;
    const userContent = buildEssayUserContent({
      chunks: selection.chunks,
      rubric,
      verbLines: verbExpectationLines(analysis.verbs, parseVerbExpectations(this.deps.registry?.skill(ESSAY_VERB_SKILL_ID)?.body)),
      exemplar,
      subject: analysis.subject,
      aspects: analysis.aspects,
      targetWords,
      ...(perQuestion.length ? { questionTargets: perQuestion.map(({ label, targetWords: words }) => ({ label, targetWords: words })) } : {}),
      question,
    });
    const system = this.deps.registry?.skill(ESSAY_WRITER_SKILL_ID)?.body ?? DEFAULT_ESSAY_WRITER;
    const placed = placeMemory(`${this.deps.systemPrompt}\n\n${system}`, { ...request.content, textContent: userContent }, this.deps.promptLayout);
    const content = { ...request.content, textContent: withReminder(placed.textContent, this.deps.reminder) };
    const filter = new EssayStreamFilter();
    const shown = request.stream ? recordingStream(request.stream) : null;
    llmCalls++;
    const first = await this.deps.invocation.answerPrepared(
      {
        provider: request.provider,
        model: request.model,
        content,
        label: request.label,
        purpose: EssayCallPurpose.WRITE,
        thinkingLevel: this.settings.thinkingLevel,
        maxOutputTokens: essayOutputTokens(targetWords, this.outputCap),
        ...(shown ? { stream: filteredStream(shown.stream, filter) } : {}),
        ...(request.cacheKey ? { cacheKey: request.cacheKey } : {}),
        ...(request.signal ? { signal: request.signal } : {}),
      },
      { systemPrompt: placed.systemPrompt, content, contexts: selection.chunks },
    );
    // 08 Bước 4: an unclosed `<essay>` or a reply cut by the output cap is continued where it stopped.
    const continued = await this.continueEssay(request, first, content, placed.systemPrompt, selection.chunks, targetWords, shown, filter);
    llmCalls += continued.calls;
    const written = { ...first, text: continued.text, ...(continued.finishReason ? { finishReason: continued.finishReason } : {}) };

    // Citation check (code, no LLM): unknown ids are dropped from the outline and from sources.
    const output = splitEssayOutput(written.text);
    const known = new Set(selection.chunks.map((chunk) => chunk.chunkId));
    const citations = checkCitations(`${output.outline}\n${output.essay}`, known);
    if (citations.unknown.length) logger.warn(`[essay] ${request.label} cited ${citations.unknown.length} unknown chunk id(s), dropped: ${citations.unknown.join(', ')}`);
    const outline = dropUnknownCitations(output.outline, known);
    let essay = stripCitationMarkers(output.essay).trim();
    if (request.stream && shown) {
      const tail = continued.filter.flush();
      if (tail) shown.stream.delta(tail);
      if (!shown.text() && essay) request.stream.delta(essay);
    }

    // ⑦ Self-check (aux) — one revise pass
    const strict = request.options.strict || this.settings.selfCheck;
    if (strict && this.deps.aux && essay) {
      llmCalls++;
      const revised = await this.selfCheck(request, analysis, targetWords, outline, essay);
      if (revised) {
        essay = revised;
        request.stream?.reset();
        request.stream?.delta(revised);
      }
    }

    const cited = citations.valid.length ? selection.chunks.filter((chunk) => citations.valid.includes(chunk.chunkId)) : selection.chunks;
    const wordCount = countWords(essay);
    logger.info(`[essay] ${request.label} — ${analysis.aspects.length} aspects (${analysis.fromModel ? 'aux' : 'heuristic'}), ${selection.chunks.length} chunks, coverage ${(selection.coverage * 100).toFixed(0)}%, ${wordCount}/${targetWords} words, ${llmCalls} LLM call(s)${domain ? `, rubric ${domain.meta.id}` : ''}`);
    return {
      ...written,
      text: essay,
      contexts: cited,
      timings: { ...(written.timings ?? { attempts: [] }), totalMs: this.now() - startedAt, retrievalMs, llmCalls },
      essay: {
        outline,
        aspects: analysis.aspects,
        targetWords,
        coverage: selection.coverage,
        strict,
        wordCount,
        droppedCitations: citations.unknown.length,
        trigger: request.options.trigger,
        ...(analysis.subject ? { subject: analysis.subject } : {}),
        ...(domain ? { domain: domain.meta.id } : {}),
      },
    };
  }

  private get maxAspects(): number {
    return this.settings.maxAspects ?? MAX_ESSAY_ASPECTS;
  }

  private get outputCap(): number {
    return this.settings.maxOutputTokens ?? MAX_ESSAY_OUTPUT_TOKENS;
  }

  /**
   * 08 Bước 4: while the writing reply is cut (output cap, or `<essay>` never closed) and ANSWER_MAX_CONTINUATIONS
   * allows, ask the same model to continue exactly where it stopped (the cut reply is the previous assistant turn).
   * A failed continuation keeps what was written.
   */
  private async continueEssay(
    request: EssayRequest,
    first: AIAnswer,
    content: PromptContent,
    systemPrompt: string,
    chunks: CitedChunk[],
    targetWords: number,
    shown: RecordingStream | null,
    firstFilter: EssayStreamFilter,
  ): Promise<{ text: string; calls: number; finishReason?: FinishReason; filter: EssayStreamFilter }> {
    let text = first.text;
    let finishReason = first.finishReason;
    let filter = firstFilter;
    let calls = 0;
    const max = this.settings.maxContinuations ?? 0;
    const instruction = this.deps.registry?.skill(ESSAY_CONTINUE_SKILL_ID)?.body?.trim() || ESSAY_CONTINUE_FALLBACK;
    while (calls < max && (finishReason === FinishReason.LENGTH || isUnclosedEssay(text))) {
      calls++;
      request.stream?.event?.({ type: AnswerEventType.CONTINUATION, n: calls });
      // Flush what the previous filter still holds, then a fresh filter already inside `<essay>` when it was opened.
      const held = filter.flush();
      if (held && shown) shown.stream.delta(held);
      filter = new EssayStreamFilter();
      if (text.includes(ESSAY_OPEN)) filter.resume();
      const replay = shown?.text() ?? '';
      const next: PromptContent = {
        ...content,
        history: [...(content.history ?? []), { role: ConversationRole.USER, text: content.textContent }, { role: ConversationRole.ASSISTANT, text }],
        textContent: instruction,
        imageBuffers: [],
      };
      const stream: AnswerStream | undefined = shown && request.stream
        ? filteredStream({ ...shown.stream, reset: () => { shown.reset(); request.stream!.reset(); if (replay) shown.stream.delta(replay); } }, filter)
        : undefined;
      const reply = await attempt(() => this.deps.invocation.answerPrepared(
        {
          provider: request.provider,
          model: request.model,
          content: next,
          label: `${request.label}-continue${calls}`,
          purpose: EssayCallPurpose.WRITE,
          thinkingLevel: this.settings.thinkingLevel,
          maxOutputTokens: essayOutputTokens(targetWords, this.outputCap),
          ...(stream ? { stream } : {}),
          ...(request.cacheKey ? { cacheKey: request.cacheKey } : {}),
          ...(request.signal ? { signal: request.signal } : {}),
        },
        { systemPrompt, content: next, contexts: chunks },
      ));
      if (!reply.ok) {
        logger.warn(`[essay] ${request.label} continuation ${calls} failed — essay kept as written (${errorMessage(reply.error)})`);
        break;
      }
      text += continuationTail(text, reply.value.text);
      finishReason = reply.value.finishReason;
    }
    if (calls) logger.info(`[essay] ${request.label} continued ${calls}×${isUnclosedEssay(text) || finishReason === FinishReason.LENGTH ? ' (still cut)' : ''}`);
    return { text, calls, filter, ...(finishReason ? { finishReason } : {}) };
  }

  /**
   * Step ①: the shared router call answers it (1 aux call for routing + analysis); only when that call
   * failed does the pipeline make its own analysis call. An answer without a usable block → heuristic.
   */
  private async analysis(request: EssayRequest, question: string): Promise<{ analysis: EssayAnalysis | null; calls: number }> {
    let calls = 0;
    if (request.sharedAnalysis) {
      const shared = await attempt(() => request.sharedAnalysis!.essayAnalysis(question));
      calls++;
      if (shared.ok && !shared.value.failed) {
        const parsed = parseAnalysisObject(shared.value.block, question, this.maxAspects);
        if (!parsed) logger.info(`[essay] ${request.label} shared analysis block unusable — heuristic`);
        return { analysis: parsed, calls };
      }
      logger.info(`[essay] ${request.label} shared aux call failed — ${this.deps.aux ? 'own analysis call' : 'heuristic'}`);
    }
    if (!this.deps.aux) return { analysis: null, calls };
    return { analysis: await this.analyse(request, question), calls: calls + 1 };
  }

  private async analyse(request: EssayRequest, question: string): Promise<EssayAnalysis | null> {
    const reply = await attempt(() => this.auxCall(request, ANALYSIS_SYSTEM_PROMPT, question, EssayCallPurpose.ANALYSIS, this.settings.analysisTimeoutMs, ANALYSIS_MAX_OUTPUT_TOKENS));
    if (!reply.ok) {
      logger.info(`[essay] ${request.label} analysis failed — heuristic (${errorMessage(reply.error)})`);
      return null;
    }
    const parsed = parseAnalysisReply(reply.value.text, question, this.maxAspects);
    if (!parsed) logger.info(`[essay] ${request.label} analysis reply unusable — heuristic`);
    return parsed;
  }

  /** The revised essay, or null when the check passed or failed. */
  private async selfCheck(request: EssayRequest, analysis: EssayAnalysis, targetWords: number, outline: string, essay: string): Promise<string | null> {
    const input = buildSelfCheckInput(analysis, targetWords, outline, essay);
    const reply = await attempt(() => this.auxCall(request, SELF_CHECK_SYSTEM_PROMPT, input, EssayCallPurpose.SELF_CHECK, this.settings.selfCheckTimeoutMs, essayOutputTokens(targetWords, this.outputCap)));
    if (!reply.ok) {
      logger.info(`[essay] ${request.label} self-check failed — essay kept (${errorMessage(reply.error)})`);
      return null;
    }
    // Only an explicit `<essay>` block counts as a revision ("OK" or any other reply keeps the essay).
    if (SELF_CHECK_OK.test(reply.value.text) || !ESSAY_BLOCK.test(reply.value.text)) return null;
    const revised = stripCitationMarkers(splitEssayOutput(reply.value.text).essay).trim();
    return revised || null;
  }

  private auxCall(request: EssayRequest, system: string, text: string, purpose: EssayCallPurpose, timeoutMs: number, maxOutputTokens: number): Promise<AIAnswer> {
    const aux = this.deps.aux!;
    const content = { textContent: text, imageBuffers: [] };
    return withTimeout(
      this.deps.invocation.answerPrepared(
        { provider: aux.provider, model: aux.model, content, label: `${request.label}-${purpose}`, purpose, maxOutputTokens, ...(request.signal ? { signal: request.signal } : {}) },
        { systemPrompt: system, content, contexts: [] },
      ),
      timeoutMs,
      `${purpose} ${aux.provider}/${aux.model}`,
    );
  }

  /** One hybrid query; a failure (embedding down) yields no chunks rather than failing the essay. Exemplars are never sources. */
  private async search(query: string): Promise<CitedChunk[]> {
    const hits = await attempt(() => this.deps.createRetriever(ESSAY_PER_QUERY_TOP_K).retrieve(query));
    if (!hits.ok) {
      logger.warn(`[essay] retrieval failed for "${query.slice(0, 60)}": ${errorMessage(hits.error)}`);
      return [];
    }
    return hits.value.filter((chunk) => !chunk.source.startsWith(EXEMPLAR_FOLDER));
  }

  /** Reranks the fused candidates against the question (keeps them all; the reranker falls back to fused order). */
  private async rerank(question: string, fused: CitedChunk[]): Promise<CitedChunk[]> {
    if (fused.length <= 1) return fused;
    const source = this.deps.reranker.wrap({ retrieve: async () => fused }, { topN: fused.length, fallbackTopK: fused.length, label: ESSAY_RERANK_LABEL });
    const ranked = await attempt(() => source.retrieve(question));
    return ranked.ok ? ranked.value : fused;
  }

  private rubricFor(chunks: CitedChunk[]): EssayRubricChoice {
    const registry = this.deps.registry;
    if (!registry) return { rubric: DEFAULT_ESSAY_RUBRIC, domain: null };
    const domain = registry.selectDomain(chunks.map((chunk) => chunk.source));
    const domainRubric = domain ? registry.essayRubric(domain) : null;
    return {
      rubric: domainRubric ?? registry.skill(ESSAY_RUBRIC_SKILL_ID)?.body ?? DEFAULT_ESSAY_RUBRIC,
      domain,
    };
  }

  /** `domains/software-testing.md` → `_exemplars/software-testing/`; optional, silent when absent. */
  private async exemplarFor(domainPath: string, question: string): Promise<string | null> {
    if (!this.deps.exemplars) return null;
    const course = domainPath.split('/').pop()!.replace(PROMPT_FILE_SUFFIX, '').replace(DOMAIN_ID_PREFIX, '');
    const found = await attempt(() => this.deps.exemplars!.find(course, question));
    return found.ok ? found.value : null;
  }
}

/** `<essay>` opened but never closed: the reply was cut (08 Bước 4). */
function isUnclosedEssay(text: string): boolean {
  const open = text.lastIndexOf(ESSAY_OPEN);
  return open >= 0 && text.indexOf(ESSAY_CLOSE, open) < 0;
}

interface RecordingStream {
  stream: AnswerStream;
  /** Text the client currently shows (since its last reset). */
  text(): string;
  reset(): void;
}

/** Remembers what the client shows, so a continuation's retry can reset and replay it. */
function recordingStream(stream: AnswerStream): RecordingStream {
  let shown = '';
  return {
    stream: {
      delta: (text) => {
        shown += text;
        stream.delta(text);
      },
      reset: () => {
        shown = '';
        stream.reset();
      },
      ...(stream.progress ? { progress: stream.progress } : {}),
      ...(stream.event ? { event: stream.event } : {}),
    },
    text: () => shown,
    reset: () => {
      shown = '';
    },
  };
}

/** The client sees only the `<essay>` part; resets clear the filter too (a retry restarts the output). */
function filteredStream(stream: AnswerStream, filter: EssayStreamFilter): AnswerStream {
  return {
    delta: (text) => {
      const out = filter.push(text);
      if (out) stream.delta(out);
    },
    reset: () => {
      filter.reset();
      stream.reset();
    },
    ...(stream.progress ? { progress: stream.progress } : {}),
    ...(stream.event ? { event: stream.event } : {}),
  };
}
