import { ServiceDisabledError, TimeoutError, UpstreamError, errorMessage } from '../../../shared/errors';
import { logger } from '../../../shared/logging/logger';
import { attempt, withTimeout } from '../../../shared/resilience';
import { UnsupportedModelError, type PromptImage } from '../../ai';
import type { CitedChunk } from '../../retrieval';
import {
  C4_LEVEL_ORDER,
  DEFAULT_C4_LEVELS,
  isBoundary,
  toDiagramSpec,
  toModelElements,
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
import { C4Notes, KNOWLEDGE_TIMEOUT_MS, MIN_TIME_FOR_RETRY_MS, PNG_MIME_TYPE } from './constants/c4Sketch.constants';
import { extractJsonObject, toCritiques, toRequirements, toSpecsByLevel } from './helpers/c4Answer.helper';
import type {
  C4LevelState,
  C4RepairInput,
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

  async sketch(request: C4SketchRequest): Promise<C4SketchResult> {
    this.ensureEnabled();
    const { catalog } = this.deps;
    const model = catalog.resolve(request.provider, request.requestedModel);
    if (request.requestedModel !== undefined && !catalog.isAllowed(request.provider, model)) {
      throw new UnsupportedModelError(request.provider, model, catalog.allowedModels(request.provider));
    }

    const started = this.now();
    const levels = C4_LEVEL_ORDER.filter((level) => (request.levels.length ? request.levels : DEFAULT_C4_LEVELS).includes(level));
    const knowledge = await this.retrieveKnowledge(request.description);
    const ctx: C4RunContext = {
      provider: request.provider,
      model,
      systemPrompt: this.prompts.system(knowledge),
      deadline: started + this.settings.deadlineMs,
      label: `c4-${started}-${++this.sequence}`,
    };
    const states = new Map<C4Level, C4LevelState>(levels.map((level) => [level, this.newState(level)]));
    const { maxElements } = this.settings;
    logger.info(`[c4] ${ctx.label} ${levels.join('+')} with ${ctx.provider}/${model}, ${knowledge.length} knowledge chunks`);

    // 1. Architect: checklist + every diagram from one shared model.
    const architect = await attempt(() => this.askJson(ctx, this.prompts.architect(request.description, levels, maxElements), [], 'architect'));
    if (!architect.ok) logger.warn(`[c4] ${ctx.label} architect failed: ${errorMessage(architect.error)}`);
    const requirements: C4Requirement[] = architect.ok ? toRequirements(architect.value.requirements) : [];
    const drafted = architect.ok ? toSpecsByLevel(architect.value.diagrams) : new Map<C4Level, C4DiagramSpec>();
    const systemName = architect.ok && typeof architect.value.systemName === 'string' ? architect.value.systemName : '';
    const sharedModel = architect.ok && architect.value.model && typeof architect.value.model === 'object' ? (architect.value.model as Record<string, unknown>) : {};
    const rules: C4ValidationRules = { maxElements, requiredElements: [...toModelElements(sharedModel.actors), ...toModelElements(sharedModel.externalSystems)] };
    const requirementsJson = JSON.stringify(requirements);

    // 2. Drafter fallback, in parallel, only for levels the architect left out.
    await Promise.all(levels.filter((level) => !drafted.has(level)).map(async (level) => {
      const draft = await attempt(() => this.askJson(ctx, this.prompts.drafter(level, request.description, requirementsJson, JSON.stringify(architect.ok ? architect.value.model ?? {} : {}), maxElements), [], `draft-${level}`));
      if (draft.ok) drafted.set(level, toDiagramSpec(draft.value));
      else states.get(level)!.result.error = errorMessage(draft.error);
    }));

    // 3. Validate and render; validator/PlantUML problems are collected for one repair call.
    await Promise.all([...drafted].map(([level, spec]) => this.tryAccept(states.get(level)!, validateDiagram(spec, level, requirements, rules))));

    const broken = [...states].filter(([, s]) => s.candidate && s.problems.length > 0);
    if (broken.length > 0 && this.timeLeft(ctx) > 0) {
      const input = new Map<C4Level, C4RepairInput>(broken.map(([level, s]) => [level, { specJson: JSON.stringify(s.candidate!.spec), problems: s.problems }]));
      const repaired = await attempt(() => this.askJson(ctx, this.prompts.repair(input, maxElements), [], 'repair'));
      if (repaired.ok) {
        const specs = toSpecsByLevel(repaired.value.diagrams);
        await Promise.all(broken.map(async ([level, s]) => {
          const spec = specs.get(level);
          if (!spec) return;
          const validation = validateDiagram(spec, level, requirements, rules);
          if (s.result.png && validation.score >= s.candidate!.score) return;
          if (await this.tryAccept(s, validation)) s.result.notes.push(C4Notes.REPAIRED);
        }));
      } else {
        logger.warn(`[c4] ${ctx.label} repair failed: ${errorMessage(repaired.error)}`);
      }
    }

    // 4. Critic sees every rendered image in one call; a revision must validate no worse and render.
    const rendered = [...states].filter(([, s]) => s.result.png);
    if (!request.fast && rendered.length > 0) {
      if (this.now() - started > this.settings.criticCutoffMs) {
        for (const [, s] of rendered) s.result.notes.push(C4Notes.REVIEW_SKIPPED_LATE);
      } else {
        await this.review(ctx, rendered, requirements, requirementsJson, rules);
      }
    }

    // 5. Report.
    const deadlineHit = this.now() >= ctx.deadline;
    for (const [, s] of states) {
      if (s.result.png && deadlineHit) s.result.notes.push(C4Notes.DEADLINE);
      if (!s.result.png) s.result.error ??= s.problems[0] ?? (deadlineHit ? C4Notes.TIMED_OUT : C4Notes.NO_DIAGRAM);
    }
    const elapsedMs = this.now() - started;
    logger.info(`[c4] ${ctx.label} done in ${elapsedMs}ms: ${[...states].map(([level, s]) => `${level}=${s.result.png ? 'ok' : 'failed'}`).join(', ')}`);
    return {
      provider: request.provider,
      model,
      systemName,
      requirements,
      knowledgeSources: [...new Set(knowledge.map((chunk) => chunk.source))],
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
      else if (await this.tryAccept(s, validation)) s.result.notes.push(`${C4Notes.REVIEW_FIXED} (${verdict.issues.slice(0, 3).join('; ')})`);
      else s.result.notes.push(C4Notes.REVIEW_REJECTED_RENDER);
    }));
  }

  /** Renders the candidate; on success it becomes the level's result. Problems are kept for the repair round. */
  private async tryAccept(state: C4LevelState, candidate: C4Validation): Promise<boolean> {
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
      error: undefined,
    };
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
