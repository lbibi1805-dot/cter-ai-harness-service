import { randomUUID } from 'crypto';
import { NotFoundError, ServiceDisabledError, TimeoutError, UpstreamError, errorMessage } from '../../../shared/errors';
import { logger } from '../../../shared/logging/logger';
import { attempt, withTimeout } from '../../../shared/resilience';
import { UnsupportedModelError, type AIProvider, type PromptImage } from '../../ai';
import type { CitedChunk } from '../../retrieval';
import {
  C4_LEVEL_ORDER,
  DEFAULT_C4_LEVELS,
  isBoundary,
  toDiagramSpec,
  validateDiagram,
  type C4DiagramSpec,
  type C4Level,
  type C4Requirement,
  type C4Validation,
  type C4ValidationRules,
} from '../domain';
import { C4PromptBuilder } from './c4Prompts.builder';
import { C4PumlBuilder } from './c4Puml.builder';
import { DESIGN_RULES_QUERY, JSON_RETRY, MAX_KNOWLEDGE_CHUNKS } from './constants/c4Prompts.constants';
import { C4_SESSION_TTL_MS, C4Notes, C4Progress, KNOWLEDGE_TIMEOUT_MS, MIN_TIME_FOR_RETRY_MS, PNG_MIME_TYPE } from './constants/c4Sketch.constants';
import { extractJsonObject, sourcesOf, toArchitectPlan, toCritiques, toSpecsByLevel } from './helpers/c4Answer.helper';
import type {
  C4ArchitectPlan,
  C4EventSink,
  C4LevelState,
  C4RepairInput,
  C4ResumeRequest,
  C4RunContext,
  C4SketchDeps,
  C4SketchRequest,
  C4SketchResult,
  C4SketchSettings,
} from './interfaces/c4Sketch.interface';

/**
 * C4 Sketcher (`POST /api/c4`): problem statement → C4 diagrams as PNG in under five minutes.
 *
 * One model call per agent, for all requested levels at once: Architect (requirement checklist + every
 * diagram from one shared model) → local validation (coverage, minimality, C4 rules) → PlantUML render →
 * Repair (only broken levels) → Critic (sees every image) → re-render. The user's knowledge base (vault RAG)
 * is retrieved once and given to every agent as design rules. Levels are validated and rendered on their own,
 * so one bad level never blocks the others, and at the deadline each level keeps its best rendered image.
 *
 * Human in the loop: when the architect reports a real ambiguity, the run pauses (clock stopped) and returns
 * its questions; `resume` continues with the user's answers (one more architect call) or with its assumptions.
 */
export class C4SketchService {
  private readonly prompts = new C4PromptBuilder();
  private readonly puml: C4PumlBuilder;
  private readonly now: () => number;
  private sequence = 0;

  constructor(
    private readonly settings: C4SketchSettings,
    private readonly deps: C4SketchDeps,
  ) {
    this.puml = new C4PumlBuilder(deps.puml);
    this.now = deps.now ?? Date.now;
  }

  ensureEnabled(): void {
    if (!this.settings.enabled) throw new ServiceDisabledError('C4 API disabled: set CHAT_API_TOKEN on the server');
  }

  async sketch(request: C4SketchRequest, sink?: C4EventSink): Promise<C4SketchResult> {
    this.ensureEnabled();
    const { catalog } = this.deps;
    const model = catalog.resolve(request.provider, request.requestedModel);
    if (request.requestedModel !== undefined && !catalog.isAllowed(request.provider, model)) {
      throw new UnsupportedModelError(request.provider, model, catalog.allowedModels(request.provider));
    }

    const started = this.now();
    const levels = this.levelsOf(request);
    sink?.progress(C4Progress.KNOWLEDGE);
    const knowledge = await this.retrieveKnowledge(request.description);
    const ctx = this.context(request.provider, model, knowledge, started, this.settings.deadlineMs, `c4-${started}-${++this.sequence}`, sink);
    logger.info(`[c4] ${ctx.label} ${levels.join('+')} with ${ctx.provider}/${model}, ${knowledge.length} knowledge chunks`);

    // 1. Architect: checklist + every diagram from one shared model (+ questions when the statement is ambiguous).
    sink?.progress(C4Progress.ARCHITECT(levels.length));
    const architect = await attempt(() => this.askJson(ctx, this.prompts.architect(request.description, levels, this.settings.maxElements), [], 'architect'));
    if (!architect.ok) logger.warn(`[c4] ${ctx.label} architect failed: ${errorMessage(architect.error)}`);
    const plan = toArchitectPlan(architect.ok ? architect.value : undefined, this.settings.maxElements);
    sink?.analysis(plan, sourcesOf(knowledge));

    if (architect.ok && plan.clarifications.length > 0) {
      const activeMs = this.now() - started;
      const id = randomUUID();
      const expiresAt = this.now() + C4_SESSION_TTL_MS;
      this.deps.sessions.save({ id, request, model, knowledge, architect: architect.value, remainingMs: this.timeLeft(ctx), activeMs, expiresAt, label: ctx.label });
      logger.info(`[c4] ${ctx.label} paused for ${plan.clarifications.length} clarification(s)`);
      return { ...this.summary(request.provider, model, plan, knowledge), levels: [], elapsedMs: activeMs, deadlineHit: false, confirmation: { sessionId: id, clarifications: plan.clarifications, expiresAt } };
    }
    return this.draw(ctx, request, plan, knowledge, 0, started);
  }

  /** Continues a paused run with the clock restarted where it stopped. */
  async resume(resume: C4ResumeRequest, sink?: C4EventSink): Promise<C4SketchResult> {
    this.ensureEnabled();
    const session = this.deps.sessions.take(resume.sessionId);
    if (!session) throw new NotFoundError('C4 session not found or expired — send /c4 again');

    const resumedAt = this.now();
    const ctx = this.context(session.request.provider, session.model, session.knowledge, resumedAt, session.remainingMs, session.label, sink);
    let architect = session.architect;
    const answers = resume.answers?.trim();
    if (answers) {
      sink?.progress(C4Progress.ARCHITECT_ANSWERS);
      const levels = this.levelsOf(session.request);
      const again = await attempt(() => this.askJson(ctx, this.prompts.architect(session.request.description, levels, this.settings.maxElements, answers), [], 'architect-answers'));
      if (again.ok) architect = again.value;
      else logger.warn(`[c4] ${ctx.label} architect (answers) failed, keeping the assumptions: ${errorMessage(again.error)}`);
    }
    const plan = toArchitectPlan(architect, this.settings.maxElements);
    sink?.analysis({ ...plan, clarifications: [] }, sourcesOf(session.knowledge));
    return this.draw(ctx, session.request, { ...plan, clarifications: [] }, session.knowledge, session.activeMs, resumedAt);
  }

  /** Steps after the architect: fallback drafts → validate + render → repair → critic → report. */
  private async draw(ctx: C4RunContext, request: C4SketchRequest, plan: C4ArchitectPlan, knowledge: CitedChunk[], activeMsBefore: number, segmentStart: number): Promise<C4SketchResult> {
    const levels = this.levelsOf(request);
    const { requirements, rules } = plan;
    const drafted = new Map<C4Level, C4DiagramSpec>([...plan.drafted].filter(([level]) => levels.includes(level)));
    const states = new Map<C4Level, C4LevelState>(levels.map((level) => [level, this.newState(level)]));
    const { maxElements } = this.settings;
    const requirementsJson = JSON.stringify(requirements);

    // 2. Drafter fallback, in parallel, only for levels the architect left out.
    const missing = levels.filter((level) => !drafted.has(level));
    if (missing.length > 0) ctx.sink?.progress(C4Progress.DRAFT(missing.length));
    await Promise.all(missing.map(async (level) => {
      const draft = await attempt(() => this.askJson(ctx, this.prompts.drafter(level, request.description, requirementsJson, plan.modelJson, maxElements), [], `draft-${level}`));
      if (draft.ok) drafted.set(level, toDiagramSpec(draft.value));
      else states.get(level)!.result.error = errorMessage(draft.error);
    }));

    // 3. Validate and render; validator/PlantUML problems are collected for one repair call.
    ctx.sink?.progress(C4Progress.RENDER);
    await Promise.all([...drafted].map(([level, spec]) => this.tryAccept(ctx, states.get(level)!, validateDiagram(spec, level, requirements, rules))));

    const broken = [...states].filter(([, s]) => s.candidate && s.problems.length > 0);
    if (broken.length > 0 && this.timeLeft(ctx) > 0) {
      ctx.sink?.progress(C4Progress.REPAIR(broken.length));
      const input = new Map<C4Level, C4RepairInput>(broken.map(([level, s]) => [level, { specJson: JSON.stringify(s.candidate!.spec), problems: s.problems }]));
      const repaired = await attempt(() => this.askJson(ctx, this.prompts.repair(input, maxElements), [], 'repair'));
      if (repaired.ok) {
        const specs = toSpecsByLevel(repaired.value.diagrams);
        await Promise.all(broken.map(async ([level, s]) => {
          const spec = specs.get(level);
          if (!spec) return;
          const validation = validateDiagram(spec, level, requirements, rules);
          if (s.result.png && validation.score >= s.candidate!.score) return;
          await this.tryAccept(ctx, s, validation, C4Notes.REPAIRED);
        }));
      } else {
        logger.warn(`[c4] ${ctx.label} repair failed: ${errorMessage(repaired.error)}`);
      }
    }

    // 4. Critic sees every rendered image in one call; a revision must validate no worse and render.
    const rendered = [...states].filter(([, s]) => s.result.png);
    if (!request.fast && rendered.length > 0) {
      if (this.now() > ctx.criticBy) {
        for (const [, s] of rendered) s.result.notes.push(C4Notes.REVIEW_SKIPPED_LATE);
      } else {
        ctx.sink?.progress(C4Progress.CRITIC);
        await this.review(ctx, rendered, requirements, requirementsJson, rules);
      }
    }

    // 5. Report.
    const deadlineHit = this.now() >= ctx.deadline;
    for (const [, s] of states) {
      if (s.result.png && deadlineHit) s.result.notes.push(C4Notes.DEADLINE);
      if (!s.result.png) s.result.error ??= s.problems[0] ?? (deadlineHit ? C4Notes.TIMED_OUT : C4Notes.NO_DIAGRAM);
    }
    const elapsedMs = activeMsBefore + this.now() - segmentStart;
    logger.info(`[c4] ${ctx.label} done in ${elapsedMs}ms: ${[...states].map(([level, s]) => `${level}=${s.result.png ? 'ok' : 'failed'}`).join(', ')}`);
    return {
      ...this.summary(ctx.provider, ctx.model, plan, knowledge),
      levels: [...states.values()].map((s) => s.result),
      elapsedMs,
      deadlineHit,
    };
  }

  private async review(
    ctx: C4RunContext,
    rendered: Array<[C4Level, C4LevelState]>,
    requirements: C4Requirement[],
    requirementsJson: string,
    rules: C4ValidationRules,
  ): Promise<void> {
    const specs = new Map(rendered.map(([level, s]) => [level, JSON.stringify(s.candidate!.spec)]));
    const images: PromptImage[] = rendered.map(([, s]) => ({ data: s.result.png!, mimeType: PNG_MIME_TYPE }));
    const critique = await attempt(() => this.askJson(ctx, this.prompts.critic(specs, requirementsJson, this.settings.maxElements), images, 'critic'));
    if (!critique.ok) {
      logger.warn(`[c4] ${ctx.label} critic failed: ${errorMessage(critique.error)}`);
      return;
    }
    const verdicts = toCritiques(critique.value.levels);
    await Promise.all(rendered.map(async ([level, s]) => {
      const verdict = verdicts.get(level);
      if (!verdict?.revise || !verdict.spec) {
        s.result.notes.push(C4Notes.REVIEW_OK);
        return;
      }
      const validation = validateDiagram(verdict.spec, level, requirements, rules);
      if (validation.score > s.candidate!.score) s.result.notes.push(C4Notes.REVIEW_REJECTED_WORSE);
      else if (!(await this.tryAccept(ctx, s, validation, `${C4Notes.REVIEW_FIXED} (${verdict.issues.slice(0, 3).join('; ')})`))) {
        s.result.notes.push(C4Notes.REVIEW_REJECTED_RENDER);
      }
    }));
  }

  /**
   * Renders the candidate; on success it becomes the level's result (with `note`) and is streamed to the client.
   * Problems are kept for the repair round.
   */
  private async tryAccept(ctx: C4RunContext, state: C4LevelState, candidate: C4Validation, note?: string): Promise<boolean> {
    const level = state.result.level;
    const source = this.puml.build(candidate.spec, level);
    const render = await attempt(() => this.deps.renderer.render(source));
    if (!render.ok || !render.value.png) {
      if (!state.result.png) state.candidate = candidate;
      state.problems = render.ok
        ? [`PlantUML rejected the diagram: ${render.value.syntaxError ?? 'unknown error'}${render.value.errorLine ? ` (line ${render.value.errorLine})` : ''}`, ...candidate.errors]
        : [errorMessage(render.error)];
      return false;
    }
    state.candidate = candidate;
    state.problems = [...candidate.errors];
    state.result = {
      ...state.result,
      title: candidate.spec.title,
      png: render.value.png,
      puml: source,
      elementCount: candidate.spec.elements.filter((e) => !isBoundary(e.kind)).length,
      covered: candidate.covered,
      missing: candidate.missing,
      notes: note ? [...state.result.notes, note] : state.result.notes,
      error: undefined,
    };
    ctx.sink?.level(state.result);
    return true;
  }

  /** Asks for a JSON object; an unparseable answer gets one retry when time allows. */
  private async askJson(ctx: C4RunContext, text: string, images: PromptImage[], step: string): Promise<Record<string, unknown>> {
    const first = extractJsonObject(await this.ask(ctx, text, images, step));
    if (first) return first;
    if (this.timeLeft(ctx) < MIN_TIME_FOR_RETRY_MS) throw new UpstreamError(`${step}: model answer is not JSON`);
    const second = extractJsonObject(await this.ask(ctx, `${text}\n\n${JSON_RETRY}`, images, `${step}-retry`));
    if (!second) throw new UpstreamError(`${step}: model answer is not JSON`);
    return second;
  }

  private ask(ctx: C4RunContext, text: string, images: PromptImage[], step: string): Promise<string> {
    const budget = Math.min(this.settings.callTimeoutMs, this.timeLeft(ctx));
    if (budget <= 0) throw new TimeoutError(`${step}: C4 deadline reached`);
    const call = this.deps.model.ask({ provider: ctx.provider, model: ctx.model, systemPrompt: ctx.systemPrompt, text, images, label: `${ctx.label}-${step}` });
    return withTimeout(call, budget, `${ctx.label}-${step}`);
  }

  private timeLeft(ctx: C4RunContext): number {
    return ctx.deadline - this.now();
  }

  /** `budgetMs` of machine time from `start`; the critic keeps the same tail it has in a full run. */
  private context(provider: AIProvider, model: string, knowledge: CitedChunk[], start: number, budgetMs: number, label: string, sink?: C4EventSink): C4RunContext {
    const deadline = start + budgetMs;
    return {
      provider,
      model,
      systemPrompt: this.prompts.system(knowledge),
      deadline,
      criticBy: deadline - (this.settings.deadlineMs - this.settings.criticCutoffMs),
      label,
      sink,
    };
  }

  private levelsOf(request: C4SketchRequest): C4Level[] {
    return C4_LEVEL_ORDER.filter((level) => (request.levels.length ? request.levels : DEFAULT_C4_LEVELS).includes(level));
  }

  private summary(provider: AIProvider, model: string, plan: C4ArchitectPlan, knowledge: CitedChunk[]) {
    return { provider, model, systemName: plan.systemName, requirements: plan.requirements, knowledgeSources: sourcesOf(knowledge) };
  }

  /** Statement-specific notes plus the user's general design rules; RAG problems only cost the notes. */
  private async retrieveKnowledge(description: string): Promise<CitedChunk[]> {
    const search = (query: string) => attempt(() => withTimeout(this.deps.knowledge.search(query), KNOWLEDGE_TIMEOUT_MS, 'c4-knowledge'));
    const results = await Promise.all([search(description), search(DESIGN_RULES_QUERY)]);
    const chunks = new Map<string, CitedChunk>();
    for (const result of results) {
      if (!result.ok) {
        logger.warn(`[c4] knowledge search failed: ${errorMessage(result.error)}`);
        continue;
      }
      for (const chunk of result.value) if (!chunks.has(chunk.chunkId)) chunks.set(chunk.chunkId, chunk);
    }
    return [...chunks.values()].slice(0, MAX_KNOWLEDGE_CHUNKS);
  }

  private newState(level: C4Level): C4LevelState {
    return { result: { level, elementCount: 0, covered: [], missing: [], notes: [] }, problems: [] };
  }
}
