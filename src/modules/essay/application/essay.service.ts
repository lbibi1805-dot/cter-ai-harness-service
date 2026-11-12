import { errorMessage } from '../../../shared/errors';
import { logger } from '../../../shared/logging/logger';
import { attempt } from '../../../shared/resilience/attempt';
import { withTimeout } from '../../../shared/resilience/withTimeout';
import type { AIAnswer, AnswerStream } from '../../ai';
import { placeMemory, withReminder } from '../../ai/domain/helpers/promptLayers.helper';
import { reciprocalRankFusion, type CitedChunk } from '../../retrieval';
import {
  ANALYSIS_MAX_OUTPUT_TOKENS,
  ANALYSIS_SYSTEM_PROMPT,
  DEFAULT_ESSAY_RUBRIC,
  DEFAULT_ESSAY_WRITER,
  DOMAIN_ID_PREFIX,
  ESSAY_BLOCK,
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
import { essayOutputTokens, heuristicAnalysis, parseAnalysisObject, parseAnalysisReply, targetWordsFor } from '../domain/helpers/essayAnalysis.helper';
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
import { buildEssayUserContent, buildSelfCheckInput, verbExpectationLines } from './helpers/essayPrompt.helper';
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
    const analysis = analysed.analysis ?? heuristicAnalysis(question);
    const points = request.options.points ?? analysis.points;
    const targetWords = targetWordsFor(points, analysis.targetWords, this.settings.wordsPerPoint);

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
      verbLines: verbExpectationLines(analysis.verbs),
      exemplar,
      subject: analysis.subject,
      aspects: analysis.aspects,
      targetWords,
      question,
    });
    const system = this.deps.registry?.skill(ESSAY_WRITER_SKILL_ID)?.body ?? DEFAULT_ESSAY_WRITER;
    const placed = placeMemory(`${this.deps.systemPrompt}\n\n${system}`, { ...request.content, textContent: userContent }, this.deps.promptLayout);
    const content = { ...request.content, textContent: withReminder(placed.textContent, this.deps.reminder) };
    const filter = new EssayStreamFilter();
    llmCalls++;
    const written = await this.deps.invocation.answerPrepared(
      {
        provider: request.provider,
        model: request.model,
        content,
        label: request.label,
        purpose: EssayCallPurpose.WRITE,
        thinkingLevel: this.settings.thinkingLevel,
        maxOutputTokens: essayOutputTokens(targetWords),
        ...(request.stream ? { stream: filteredStream(request.stream, filter) } : {}),
        ...(request.cacheKey ? { cacheKey: request.cacheKey } : {}),
        ...(request.signal ? { signal: request.signal } : {}),
      },
      { systemPrompt: placed.systemPrompt, content, contexts: selection.chunks },
    );

    // Citation check (code, no LLM): unknown ids are dropped from the outline and from sources.
    const output = splitEssayOutput(written.text);
    const known = new Set(selection.chunks.map((chunk) => chunk.chunkId));
    const citations = checkCitations(`${output.outline}\n${output.essay}`, known);
    if (citations.unknown.length) logger.warn(`[essay] ${request.label} cited ${citations.unknown.length} unknown chunk id(s), dropped: ${citations.unknown.join(', ')}`);
    const outline = dropUnknownCitations(output.outline, known);
    let essay = stripCitationMarkers(output.essay).trim();
    if (request.stream) {
      const tail = filter.flush();
      if (tail) request.stream.delta(tail);
      if (!filter.emitted() && essay) request.stream.delta(essay);
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
        const parsed = parseAnalysisObject(shared.value.block, question);
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
    const parsed = parseAnalysisReply(reply.value.text, question);
    if (!parsed) logger.info(`[essay] ${request.label} analysis reply unusable — heuristic`);
    return parsed;
  }

  /** The revised essay, or null when the check passed or failed. */
  private async selfCheck(request: EssayRequest, analysis: EssayAnalysis, targetWords: number, outline: string, essay: string): Promise<string | null> {
    const input = buildSelfCheckInput(analysis, targetWords, outline, essay);
    const reply = await attempt(() => this.auxCall(request, SELF_CHECK_SYSTEM_PROMPT, input, EssayCallPurpose.SELF_CHECK, this.settings.selfCheckTimeoutMs, essayOutputTokens(targetWords)));
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
  };
}
