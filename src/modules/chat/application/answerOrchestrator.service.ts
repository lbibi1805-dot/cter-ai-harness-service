import { errorMessage } from '../../../shared/errors';
import { logger } from '../../../shared/logging/logger';
import { continuationTail } from '../../../shared/text';
import { AnswerMode, type Answerer, type AnswerRequest, type AnswerResult } from '../../agent/domain';
import { AnswerEventType, ConversationRole, FinishReason, retrievalQuery, type AnswerStream, type ConversationTurn, type PromptContent } from '../../ai';
import type { CitedChunk } from '../../retrieval/domain/interfaces/retrieval.interface';
import {
  ANSWER_BLOCK_SEPARATOR,
  ANSWER_LOG_TAG,
  ANSWER_PART_SEPARATOR,
  DEFAULT_ANSWER_COMPLETENESS,
  PLAN_NOTHING_DONE,
} from '../domain/constants/answerPlan.constants';
import { CONTINUATION_OVERLAP_MAX_CHARS } from '../../../shared/text/constants/questionSplit.constants';
import { buildAnswerPlan, checkCoverage, groupSections, labelList, planLines, renderTemplate } from '../domain/helpers/answerPlan.helper';
import type { AnswerCompletenessDetails, AnswerCompletenessSettings, AnswerPlan, AnswerPrompts, PlannedQuestion } from '../domain/interfaces/answerPlan.interface';
import { AnswerMetrics } from './answerMetrics.service';
import { DEFAULT_ANSWER_PROMPTS } from './constants/answerPrompts.constants';

/** How a call's text is attached to what was already written. */
enum JoinMode {
  /** New section / coverage fix: blank line, then the text. */
  SEPARATE = 'separate',
  /** Auto-continuation: the text continues where the cut stopped (repeated tail dropped). */
  CONTINUE = 'continue',
}

/** One model call of the turn: its result, or the text it streamed before failing. */
interface CallOutcome {
  /** Text to append (already joined to the prefix rules). */
  appended: string;
  result?: AnswerResult;
  /** True when the call failed after streaming text (continued like a cut answer). */
  interrupted: boolean;
  error?: unknown;
}

interface TurnState {
  text: string;
  results: AnswerResult[];
  continuations: number;
  lastFinish?: FinishReason;
  interrupted: boolean;
}

/**
 * 12/11 plan 08 Bước 3: wraps every text-answer path (chat single-shot and agent, Canvas conversation replies,
 * file Q&A) so one turn answers EVERY question of the prompt, long enough, without the user typing "làm tiếp":
 *
 * plan (rule-based question split, 0 model calls) → one call with an `<answer_plan>` block next to the question
 * (layer ⑦: the static prefix and KV cache are untouched) or, when the plan does not fit one call, consecutive
 * sections of ≤ ANSWER_SECTION_MAX_QUESTIONS questions streamed into the SAME answer → auto-continue when a call
 * stops on the output cap (or fails after streaming text) → rule-based coverage check → at most one call writing
 * only the missing questions. The client sees one continuous text plus `answer_plan` / `section` / `continuation` /
 * `coverage` events; one assembled assistant message is stored.
 */
export class AnswerOrchestrator implements Answerer {
  readonly metrics: AnswerMetrics;
  private readonly settings: AnswerCompletenessSettings;

  constructor(
    private readonly inner: Answerer,
    settings: Partial<AnswerCompletenessSettings> = {},
    private readonly prompts: AnswerPrompts = DEFAULT_ANSWER_PROMPTS,
    private readonly now: () => number = Date.now,
    metrics?: AnswerMetrics,
  ) {
    this.settings = { ...DEFAULT_ANSWER_COMPLETENESS, ...settings };
    this.metrics = metrics ?? new AnswerMetrics();
  }

  get enabled(): boolean {
    return this.settings.enabled;
  }

  async answer(request: AnswerRequest): Promise<AnswerResult> {
    if (!this.settings.enabled) return this.inner.answer(request);
    const started = this.now();
    const question = request.content.textContent;
    const plan = buildAnswerPlan(question, this.settings);
    const multi = plan.questions.length >= 2;
    const callSpan = request.deadlineAt ? Math.max(0, request.deadlineAt - started) : this.settings.callDeadlineMs;
    const turnDeadline = started + Math.max(callSpan, this.settings.longAnswerDeadlineMs);
    // RAG keeps searching the user's question, not the plan / continuation instructions.
    const query = request.content.retrievalQuery?.trim() || retrievalQuery(request.content);
    const groups = request.mode === AnswerMode.AGENT ? [plan.questions] : groupSections(plan, this.settings);
    const stream = request.stream;
    if (multi) stream?.event?.({ type: AnswerEventType.ANSWER_PLAN, total: plan.questions.length, questions: plan.questions.map(({ id, label }) => ({ id, label })) });

    const state: TurnState = { text: '', results: [], continuations: 0, interrupted: false };
    let sections = 0;
    for (const [index, group] of groups.entries()) {
      if (index > 0 && this.now() >= turnDeadline) break;
      sections++;
      if (groups.length > 1) stream?.event?.({ type: AnswerEventType.SECTION, index: index + 1, total: groups.length });
      const done = groups.slice(0, index).flat();
      const userText = this.userText(question, plan, multi, groups.length > 1 ? { index, total: groups.length, group, done } : null);
      const content: PromptContent = { ...request.content, textContent: userText, retrievalQuery: query };
      const first = index === 0;
      const deadlineAt = first ? request.deadlineAt ?? (multi ? turnDeadline : undefined) : this.callDeadline(turnDeadline, callSpan);
      const sectionStart = state.text.length;
      const outcome = await this.call(request, content, first ? request.mode : AnswerMode.SINGLE_SHOT, deadlineAt, state.text, JoinMode.SEPARATE);
      // Nothing written at all: the turn fails like before (the caller reports the error).
      if (first && !outcome.result && !outcome.appended) throw outcome.error;
      this.absorb(state, outcome);
      if (!outcome.result && !outcome.appended) break;
      await this.continueSection(request, state, content, sectionStart, query, turnDeadline, callSpan);
    }

    const coverage = multi ? await this.cover(request, state, plan, question, query, turnDeadline, callSpan) : { missing: [], fixed: false };
    if (multi) stream?.event?.({ type: AnswerEventType.COVERAGE, missing: coverage.missing });
    const details: AnswerCompletenessDetails = {
      questions: plan.questions.length,
      sections,
      continuations: state.continuations,
      coverageFix: coverage.fixed,
      missing: coverage.missing,
      truncated: state.lastFinish === FinishReason.LENGTH,
    };
    const result = this.assemble(state, details, started);
    const long = multi || sections > 1 || state.continuations > 0 || coverage.fixed;
    this.metrics.record({ ...details, durationMs: this.now() - started, long, ...(result.timings?.outputTokens !== undefined ? { outputTokens: result.timings.outputTokens } : {}) });
    if (long) {
      logger.info(`${ANSWER_LOG_TAG} ${request.label}: ${details.questions} question(s), ${sections} section(s), ${state.continuations} continuation(s)${coverage.fixed ? ', coverage fix' : ''}${coverage.missing.length ? `, missing ${coverage.missing.join(',')}` : ''}${details.truncated ? ', still truncated' : ''} in ${this.now() - started}ms`);
    }
    return result;
  }

  /** Question + `<answer_plan>` (multi-question) + `<answer_section>` (sectioned) — all after the question (layer ⑦). */
  private userText(question: string, plan: AnswerPlan, multi: boolean, section: { index: number; total: number; group: PlannedQuestion[]; done: PlannedQuestion[] } | null): string {
    const blocks = [question];
    if (multi) blocks.push(renderTemplate(this.prompts.plan, { total: plan.questions.length, questions: planLines(plan.questions) }));
    if (section) {
      blocks.push(renderTemplate(this.prompts.section, {
        index: section.index + 1,
        total: section.total,
        done: section.done.length ? section.done.map((q) => q.label).join(', ') : PLAN_NOTHING_DONE,
        labels: labelList(section.group),
      }));
    }
    return blocks.join(ANSWER_BLOCK_SEPARATOR);
  }

  private callDeadline(turnDeadline: number, callSpan: number): number {
    return Math.min(turnDeadline, this.now() + Math.max(callSpan, this.settings.callDeadlineMs));
  }

  /** Auto-continue (08 Bước 2/3): while the section's last call stopped on the output cap or broke mid-stream. */
  private async continueSection(request: AnswerRequest, state: TurnState, content: PromptContent, sectionStart: number, query: string, turnDeadline: number, callSpan: number): Promise<void> {
    for (let n = 0; n < this.settings.maxContinuations; n++) {
      if (state.lastFinish !== FinishReason.LENGTH && !state.interrupted) return;
      if (this.now() >= turnDeadline) return;
      state.continuations++;
      request.stream?.event?.({ type: AnswerEventType.CONTINUATION, n: state.continuations });
      const written = state.text.slice(sectionStart).trimStart();
      const followUp = this.followUp(content, written, this.prompts.continue, query);
      const outcome = await this.call(request, followUp, AnswerMode.SINGLE_SHOT, this.callDeadline(turnDeadline, callSpan), state.text, JoinMode.CONTINUE);
      if (!outcome.result && !outcome.appended) {
        logger.warn(`${ANSWER_LOG_TAG} ${request.label}: continuation ${state.continuations} failed (${errorMessage(outcome.error)})`);
        return;
      }
      this.absorb(state, outcome);
    }
  }

  /** Coverage check, then at most one call writing only the missing questions (ANSWER_COVERAGE_FIX). */
  private async cover(request: AnswerRequest, state: TurnState, plan: AnswerPlan, question: string, query: string, turnDeadline: number, callSpan: number): Promise<{ missing: string[]; fixed: boolean }> {
    const before = checkCoverage(state.text, plan.questions);
    if (!before.missing.length || !this.settings.coverageFix || this.now() >= turnDeadline) return { missing: before.missing, fixed: false };
    const missing = plan.questions.filter((q) => before.missing.includes(q.id));
    const userText = this.userText(question, plan, true, null);
    const content: PromptContent = { ...request.content, textContent: userText, retrievalQuery: query };
    const instruction = renderTemplate(this.prompts.coverageFix, { missing: labelList(missing) });
    const outcome = await this.call(request, this.followUp(content, state.text, instruction, query), AnswerMode.SINGLE_SHOT, this.callDeadline(turnDeadline, callSpan), state.text, JoinMode.SEPARATE);
    if (!outcome.result && !outcome.appended) {
      logger.warn(`${ANSWER_LOG_TAG} ${request.label}: coverage fix failed (${errorMessage(outcome.error)})`);
      return { missing: before.missing, fixed: false };
    }
    this.absorb(state, outcome);
    return { missing: checkCoverage(state.text, plan.questions).missing, fixed: true };
  }

  /** The call's prompt as the next user turn after the text written so far (images stay on the original turn). */
  private followUp(content: PromptContent, written: string, instruction: string, query: string): PromptContent {
    const asked: ConversationTurn = { role: ConversationRole.USER, text: content.textContent, ...(content.imageBuffers.length ? { images: content.imageBuffers } : {}) };
    const answered: ConversationTurn = { role: ConversationRole.ASSISTANT, text: written };
    return { ...content, history: [...(content.history ?? []), asked, answered], textContent: instruction, imageBuffers: [], retrievalQuery: query };
  }

  private absorb(state: TurnState, outcome: CallOutcome): void {
    state.text += outcome.appended;
    if (outcome.result) state.results.push(outcome.result);
    state.lastFinish = outcome.result?.finishReason;
    state.interrupted = outcome.interrupted;
  }

  /**
   * One model call streaming into the client after `prefix`. A retry inside the call resets the client and replays
   * the prefix (the client never loses earlier parts). A call that throws after streaming text returns that text.
   */
  private async call(request: AnswerRequest, content: PromptContent, mode: AnswerMode | undefined, deadlineAt: number | undefined, prefix: string, join: JoinMode): Promise<CallOutcome> {
    const relay = request.stream ? new SegmentStream(request.stream, prefix, join) : null;
    try {
      const result = await this.inner.answer({ ...request, content, mode, ...(deadlineAt !== undefined ? { deadlineAt } : {}), ...(relay ? { stream: relay.stream } : {}) });
      relay?.finish();
      return { appended: joinText(prefix, result.text, join), result, interrupted: false };
    } catch (error) {
      relay?.finish();
      const partial = relay?.captured() ?? '';
      if (!partial.trim()) return { appended: '', interrupted: false, error };
      logger.warn(`${ANSWER_LOG_TAG} ${request.label}: call failed after ${partial.length} streamed chars (${errorMessage(error)}) — continuing from there`);
      return { appended: joinText(prefix, partial, join), interrupted: true, error };
    }
  }

  private assemble(state: TurnState, completeness: AnswerCompletenessDetails, started: number): AnswerResult {
    const [first] = state.results;
    const last = state.results[state.results.length - 1];
    const base: AnswerResult = first ?? { text: '', model: '', attempts: 0, contexts: [] };
    const sum = (pick: (r: AnswerResult) => number | undefined) => {
      const values = state.results.map(pick).filter((v): v is number => v !== undefined);
      return values.length ? values.reduce((a, b) => a + b, 0) : undefined;
    };
    const outputTokens = sum((r) => r.timings?.outputTokens);
    const inputTokens = sum((r) => r.timings?.inputTokens);
    const timings = base.timings && state.results.length > 1
      ? {
          ...base.timings,
          totalMs: this.now() - started,
          attempts: state.results.flatMap((r) => r.timings?.attempts ?? []),
          llmCalls: state.results.length,
          ...(outputTokens !== undefined ? { outputTokens } : {}),
          ...(inputTokens !== undefined ? { inputTokens } : {}),
        }
      : base.timings;
    return {
      ...base,
      text: state.text,
      model: last?.model ?? base.model,
      attempts: state.results.reduce((n, r) => n + r.attempts, 0),
      contexts: dedupeContexts(state.results.flatMap((r) => r.contexts ?? [])),
      ...(timings ? { timings } : {}),
      ...(state.lastFinish ? { finishReason: state.lastFinish } : {}),
      completeness,
    };
  }
}

function joinText(prefix: string, text: string, join: JoinMode): string {
  if (!prefix) return text;
  if (join === JoinMode.CONTINUE) return continuationTail(prefix, text);
  return `${ANSWER_PART_SEPARATOR}${text.trimStart()}`;
}

function dedupeContexts(chunks: CitedChunk[]): CitedChunk[] {
  const seen = new Set<string>();
  return chunks.filter((chunk) => (seen.has(chunk.chunkId) ? false : (seen.add(chunk.chunkId), true)));
}

/**
 * The client stream as one call of a multi-part answer sees it: a separator before a new part, the repeated tail of
 * a continuation dropped (its first ≤ 200 chars are held until the overlap is known), and `reset` replays the prefix.
 */
class SegmentStream {
  readonly stream: AnswerStream;
  private raw = '';
  private held = '';
  private started = false;

  constructor(private readonly client: AnswerStream, private readonly prefix: string, private readonly join: JoinMode) {
    this.stream = {
      delta: (text) => this.delta(text),
      reset: () => this.reset(),
      ...(client.progress ? { progress: client.progress } : {}),
      ...(client.event ? { event: client.event } : {}),
    };
  }

  /** Text this call streamed (since its last reset). */
  captured(): string {
    return this.raw;
  }

  /** Flushes a continuation's held head (a short continuation never reached the overlap window). */
  finish(): void {
    if (this.started || !this.held) return;
    this.started = true;
    const tail = continuationTail(this.prefix, this.held);
    this.held = '';
    if (tail) this.client.delta(tail);
  }

  private delta(text: string): void {
    this.raw += text;
    if (!this.prefix) return this.client.delta(text);
    if (this.join === JoinMode.SEPARATE) {
      if (!this.started) {
        this.started = true;
        this.client.delta(ANSWER_PART_SEPARATOR);
        text = text.trimStart();
      }
      if (text) this.client.delta(text);
      return;
    }
    if (this.started) return this.client.delta(text);
    this.held += text;
    if (this.held.length < CONTINUATION_OVERLAP_MAX_CHARS) return;
    this.finish();
  }

  private reset(): void {
    this.raw = '';
    this.held = '';
    this.started = false;
    this.client.reset();
    if (this.prefix) this.client.delta(this.prefix);
  }
}
