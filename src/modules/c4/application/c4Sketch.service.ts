import { randomUUID } from 'crypto';
import { NotFoundError, ServiceDisabledError, errorMessage } from '../../../shared/errors';
import { logger } from '../../../shared/logging/logger';
import { attempt, withTimeout } from '../../../shared/resilience';
import { UnsupportedModelError, type AIProvider, type PromptImage } from '../../ai';
import { artifactAlias, auxResolveRequest, DEFAULT_RESOLVER_SETTINGS, displayLabel, resolveArtifactsWithAux, ArtifactResolverMode } from '../../context';
import { ArtifactKind, type ConversationSnapshot, type StoredArtifact } from '../../conversation-store';
import type { CitedChunk } from '../../retrieval';
import {
  classifyIntent,
  fallbackIntent,
  GENERATING_INTENTS,
  RequestIntent,
  REVIEWING_INTENTS,
  type AuxRouterSession,
  type IntentDecision,
  type IntentInput,
} from '../../routing';
import {
  analyzeGaps,
  applyAnswers,
  briefLevels,
  briefStatement,
  briefSummary,
  C4_LEVEL_ORDER,
  C4WorkflowStep,
  ConnectivityCode,
  describeConnectivity,
  isAcceptAll,
  isBoundary,
  levelsFromText,
  toDiagramSpec,
  validateDiagram,
  type C4DiagramSpec,
  type C4Level,
  type C4Requirement,
  type C4Validation,
  type C4ValidationRules,
  type ProblemBrief,
} from '../domain';
import { C4BriefService } from './c4Brief.service';
import { C4DiscussionService } from './c4Discussion.service';
import { C4ModelCaller } from './c4ModelCaller';
import { C4PromptBuilder } from './c4Prompts.builder';
import { C4PumlBuilder } from './c4Puml.builder';
import { C4ReviewService } from './c4Review.service';
import { DESIGN_RULES_QUERY, MAX_KNOWLEDGE_CHUNKS, REVIEW_RUBRIC_QUERY } from './constants/c4Prompts.constants';
import {
  C4_SESSION_TTL_MS,
  C4FlowProgress,
  C4Notes,
  C4Progress,
  C4Step,
  CriticNotes,
  KNOWLEDGE_TIMEOUT_MS,
  PNG_MIME_TYPE,
} from './constants/c4Sketch.constants';
import { sourcesOf, toArchitectPlan, toCritiques, toSpecsByLevel } from './helpers/c4Answer.helper';
import type {
  C4ArchitectPlan,
  C4ConnectivityStats,
  C4DesignRef,
  C4DrawInput,
  C4EventSink,
  C4LevelState,
  C4RepairInput,
  C4ResumeRequest,
  C4Revision,
  C4RunContext,
  C4Session,
  C4SketchDeps,
  C4SketchRequest,
  C4SketchResult,
  C4SketchSettings,
} from './interfaces/c4Sketch.interface';

/** Everything the steps after the clarify gate need (first run or resumed). */
interface RunState {
  request: C4SketchRequest;
  brief: ProblemBrief;
  intent: IntentDecision;
  design: C4DesignRef | null;
  knowledge: CitedChunk[];
  /** The clarify reply (given to the architect verbatim). */
  answers?: string;
  activeMsBefore: number;
  segmentStart: number;
  /** What the turn records as the user's text, and which images (only the first turn records them). */
  userText: string;
  images: PromptImage[];
  recordBrief: boolean;
}

/**
 * C4 agent flow (`POST /api/c4`, note 05): a fixed workflow with gates, not a free agent.
 *
 * Intake → Intent Router (rules; one aux call only when undecided, shared with the artifact resolver)
 * → Extract (problem images + typed text → ProblemBrief, typed text wins) → Gap analysis (ask ≤ 3 slots
 * with defaults, else go on) → [Clarify: pause in `conversations.state.pendingC4`, clock stopped]
 * → Generate (architect, or c4_revise from the base spec the resolver picked) → Validate/Render
 * → Repair → Critique (≤ 1 round, readable notes) → Discussion (T1–T7, plan 04 §5.3; also with `fast`,
 * skipped only for `noDiscussion` or C4_DESIGN_DISCUSSION_ENABLED=false) → Review (c4_review /
 * c4_generate_and_review) → Respond (turn recorded: brief, diagrams, discussion, review as artifacts).
 */
export class C4SketchService {
  private readonly prompts: C4PromptBuilder;
  private readonly puml: C4PumlBuilder;
  private readonly now: () => number;
  private readonly calls: C4ModelCaller;
  private readonly briefs: C4BriefService;
  private readonly reviewer: C4ReviewService;
  private readonly discussions: C4DiscussionService;
  private readonly connectivity: C4ConnectivityStats = { orphanFound: 0, orphanRepaired: 0, connectivityErrors: 0 };
  private sequence = 0;

  constructor(
    private readonly settings: C4SketchSettings,
    private readonly deps: C4SketchDeps,
  ) {
    this.prompts = new C4PromptBuilder(deps.skills ?? null, deps.sharedRules ?? null, deps.reminder ?? '');
    this.puml = new C4PumlBuilder(deps.puml);
    this.now = deps.now ?? Date.now;
    this.calls = new C4ModelCaller(deps.model, this.prompts, settings.callTimeoutMs, this.now);
    this.briefs = new C4BriefService(this.calls, this.prompts, deps.aux ?? null);
    this.reviewer = new C4ReviewService(this.calls, this.prompts, deps.conversations);
    this.discussions = new C4DiscussionService(this.calls, this.prompts);
  }

  /** Connectivity counters since start (RAM only; `GET /api/metrics/latency` → `diagramGuard`). */
  connectivityStats(): C4ConnectivityStats {
    return { ...this.connectivity };
  }

  ensureEnabled(): void {
    if (!this.settings.enabled) throw new ServiceDisabledError('C4 API disabled: set CHAT_API_TOKEN on the server');
  }

  async sketch(input: C4SketchRequest, sink?: C4EventSink): Promise<C4SketchResult> {
    this.ensureEnabled();
    // With the conversation store, every run belongs to a conversation (a new one when the client sent none).
    const request = this.deps.conversations && !input.conversationId ? { ...input, conversationId: randomUUID() } : input;
    const snapshot = input.conversationId && this.deps.conversations ? await this.deps.conversations.open(input.conversationId) : null;
    const { catalog } = this.deps;
    const model = catalog.resolve(request.provider, request.requestedModel);
    if (request.requestedModel !== undefined && !catalog.isAllowed(request.provider, model)) {
      throw new UnsupportedModelError(request.provider, model, catalog.allowedModels(request.provider));
    }
    const started = this.now();
    const label = `c4-${started}-${++this.sequence}`;

    // Intake → Route (rules; aux only when undecided — the same call answers the artifact refs).
    sink?.progress(C4FlowProgress.ROUTE);
    const { decision, session } = await this.route(request, snapshot);
    let intent = decision;
    sink?.intent?.(intent);
    const design = this.needsDesign(intent.intent) ? await this.resolveDesign(request, snapshot, session, intent.intent) : null;

    // Extract (with the knowledge search in parallel: both only need the request).
    const reviewing = REVIEWING_INTENTS.includes(intent.intent);
    sink?.progress(C4FlowProgress.EXTRACT(request.images.length));
    const extractCtx = this.context(request.provider, model, [], started, this.settings.deadlineMs, label, sink);
    const [brief, knowledge] = await Promise.all([this.briefs.extract(extractCtx, request), this.retrieveKnowledge(request.description, reviewing)]);
    sink?.brief?.(brief);
    logger.info(`[c4] ${label} intent ${intent.intent} (${intent.source} ${intent.confidence}), ${knowledge.length} knowledge chunks, ${request.images.length} image(s)`);

    // Nothing to review (no design sent, none in the conversation): draw first, then review it.
    if (intent.intent === RequestIntent.C4_REVIEW && !C4ReviewService.hasDesign(brief, request.images, design)) {
      intent = { intent: RequestIntent.C4_GENERATE_AND_REVIEW, confidence: intent.confidence, source: intent.source, reason: 'nothing to review yet' };
      sink?.intent?.(intent);
    }
    const ctx = this.context(request.provider, model, knowledge, started, this.settings.deadlineMs, label, sink);

    // Gap analysis → Clarify (pause) or go on.
    const gaps = analyzeGaps(brief, {
      fast: request.fast,
      reviewWithDesign: intent.intent === RequestIntent.C4_REVIEW,
      revise: intent.intent === RequestIntent.C4_REVISE && !!design,
    });
    if (gaps.questions.length > 0) return this.pause(ctx, request, model, knowledge, intent, brief, design, gaps.questions, started);
    logger.info(`[c4] ${label} no questions (${gaps.skipped})`);
    return this.run(ctx, {
      request, brief, intent, design, knowledge, activeMsBefore: 0, segmentStart: started,
      userText: request.description, images: request.images, recordBrief: true,
    });
  }

  /** Continues a paused run with the clock restarted where it stopped; the reply fills the asked slots. */
  async resume(resume: C4ResumeRequest, sink?: C4EventSink): Promise<C4SketchResult> {
    this.ensureEnabled();
    const session = await this.deps.sessions.take(resume.sessionId);
    if (!session) throw new NotFoundError('C4 session not found or expired — send /c4 again');

    const resumedAt = this.now();
    const ctx = this.context(session.request.provider, session.model, session.knowledge, resumedAt, session.remainingMs, session.label, sink);
    const reply = resume.answers?.trim();
    const acceptAll = isAcceptAll(reply);
    if (!acceptAll) sink?.progress(C4FlowProgress.ANSWERS);
    const answers = await this.briefs.parseReply(reply, session.questions);
    const brief = applyAnswers(session.brief, session.questions, answers);
    sink?.intent?.(session.intent);
    sink?.brief?.(brief);
    return this.run(ctx, {
      request: { ...session.request, conversationId: session.conversationId ?? session.request.conversationId },
      brief,
      intent: session.intent,
      design: session.design ?? null,
      knowledge: session.knowledge,
      ...(acceptAll ? {} : { answers: reply }),
      activeMsBefore: session.activeMs,
      segmentStart: resumedAt,
      userText: acceptAll ? '(giữ mặc định)' : reply!,
      images: [],
      recordBrief: !acceptAll,
    });
  }

  // ── workflow steps ────────────────────────────────────────────────────────

  private async route(request: C4SketchRequest, snapshot: ConversationSnapshot | null): Promise<{ decision: IntentDecision; session: AuxRouterSession | null }> {
    const designs = (snapshot?.artifacts ?? []).filter((a) => a.kind === ArtifactKind.C4_SPEC).length;
    const input: IntentInput = {
      text: request.description,
      slash: true,
      reviewFlag: !!request.review,
      explicitIntent: request.intent ?? null,
      imageCount: request.images.length,
      designCount: designs,
      refCount: request.refArtifactIds?.length ?? 0,
    };
    const router = this.deps.router;
    const session = router?.session(input) ?? null;
    if (!router) return { decision: classifyIntent(input) ?? fallbackIntent(input), session };
    const decision = await router.route(input, session, auxResolveRequest(this.resolveInput(request, snapshot), this.resolverSettings().auxTimeoutMs));
    return { decision, session };
  }

  private needsDesign(intent: RequestIntent): boolean {
    return intent === RequestIntent.C4_REVISE || intent === RequestIntent.C4_REVIEW;
  }

  private resolverSettings() {
    return { ...DEFAULT_RESOLVER_SETTINGS, ...this.deps.resolver };
  }

  private resolveInput(request: C4SketchRequest, snapshot: ConversationSnapshot | null) {
    return {
      question: request.description,
      artifacts: snapshot?.artifacts ?? [],
      messages: snapshot?.messages ?? [],
      ...(request.refArtifactIds?.length ? { refIds: request.refArtifactIds } : {}),
      settings: this.resolverSettings(),
    };
  }

  /**
   * The design to revise / review (note 17 §3): explicit refs → rules → the request's aux session (same
   * call as the intent). Not "newest by default": the newest c4_spec is only the fallback when the
   * resolver finds no reference at all.
   */
  private async resolveDesign(request: C4SketchRequest, snapshot: ConversationSnapshot | null, session: AuxRouterSession | null, intent: RequestIntent): Promise<C4DesignRef | null> {
    const artifacts = snapshot?.artifacts ?? [];
    if (artifacts.length === 0) return null;
    const wanted = intent === RequestIntent.C4_REVIEW ? [ArtifactKind.C4_SPEC, ArtifactKind.USER_IMAGE] : [ArtifactKind.C4_SPEC];
    const settings = this.resolverSettings();
    const aux = settings.mode === ArtifactResolverMode.RULES_AUX ? session : null;
    const resolution = await resolveArtifactsWithAux(this.resolveInput(request, snapshot), aux);
    let pick: StoredArtifact | undefined = resolution.picked.find((a) => wanted.includes(a.kind));
    // A picked PNG/PUML stands for the spec of the same design.
    if (!pick) {
      const sibling = resolution.picked.find((a) => a.kind === ArtifactKind.C4_PNG || a.kind === ArtifactKind.C4_PUML);
      pick = sibling ? artifacts.find((a) => a.kind === ArtifactKind.C4_SPEC && a.messageId === sibling.messageId) : undefined;
    }
    if (!pick && intent === RequestIntent.C4_REVISE) pick = artifacts.filter((a) => a.kind === ArtifactKind.C4_SPEC).at(-1);
    if (!pick) return null;
    logger.info(`[c4] design ${artifactAlias(pick)} (${resolution.source}${resolution.ambiguous ? ', ambiguous: newest default' : ''})`);
    return {
      artifactId: pick.id, alias: artifactAlias(pick), kind: pick.kind, label: displayLabel(pick), version: pick.version ?? 1,
      dataJson: pick.dataJson, objectKey: pick.objectKey, mime: pick.mime,
    };
  }

  /** Clarify: the brief summary + ≤ 3 questions with defaults; the run waits in pendingC4 (clock stopped). */
  private async pause(
    ctx: C4RunContext, request: C4SketchRequest, model: string, knowledge: CitedChunk[], intent: IntentDecision,
    brief: ProblemBrief, design: C4DesignRef | null, questions: C4Session['questions'], started: number,
  ): Promise<C4SketchResult> {
    const activeMs = this.now() - started;
    const id = randomUUID();
    const expiresAt = this.now() + C4_SESSION_TTL_MS;
    const summary = briefSummary(brief);
    await this.deps.sessions.save({
      id, step: C4WorkflowStep.CLARIFY, request, model, knowledge, remainingMs: this.calls.timeLeft(ctx), activeMs, expiresAt, label: ctx.label,
      conversationId: request.conversationId, intent, intentConfidence: intent.confidence, brief, systemName: brief.systemName.value, summary, questions, design,
    });
    const clarify = { sessionId: id, summary, questions, expiresAt };
    ctx.sink?.clarify?.(clarify);
    logger.info(`[c4] ${ctx.label} paused for ${questions.length} question(s): ${questions.map((q) => q.slot).join(', ')}`);
    const paused: C4SketchResult = {
      ...this.summary(ctx.provider, model, brief.systemName.value, [], knowledge),
      levels: [], elapsedMs: activeMs, deadlineHit: false, intent, brief, clarify,
      confirmation: { sessionId: id, clarifications: questions.map((q) => ({ question: q.question, assumption: q.default })), expiresAt },
    };
    return this.recorded(paused, request, { userText: request.description, images: request.images, paused: true, recordBrief: true });
  }

  /** After the gate: generate (or revise) and/or review, then record the turn. */
  private async run(ctx: C4RunContext, state: RunState): Promise<C4SketchResult> {
    const { request, brief, intent } = state;
    let result: C4SketchResult = {
      ...this.summary(ctx.provider, ctx.model, brief.systemName.value, [], state.knowledge),
      levels: [], elapsedMs: 0, deadlineHit: false,
    };
    if (GENERATING_INTENTS.includes(intent.intent)) {
      const revise = intent.intent === RequestIntent.C4_REVISE && !!state.design && state.design.kind === ArtifactKind.C4_SPEC;
      result = await this.draw(ctx, { request, brief, answers: state.answers, design: state.design, revise }, state.knowledge, state.activeMsBefore, state.segmentStart);
    }
    // Discussion (plan 04 §5.3): after the critic, before the review; with `fast` too, skipped only on request.
    let discussion: C4SketchResult['discussion'];
    if (this.discussionWanted(request) && C4DiscussionService.hasDesign(result.levels)) {
      const discussionCtx = { ...ctx, deadline: Math.max(ctx.deadline, this.now() + this.settings.callTimeoutMs) };
      discussion = await this.discussions.discuss(discussionCtx, { brief, typedText: request.description, levels: result.levels });
    }
    let review: C4SketchResult['review'];
    if (REVIEWING_INTENTS.includes(intent.intent)) {
      const generated = intent.intent === RequestIntent.C4_GENERATE_AND_REVIEW ? result.levels : undefined;
      const reviewCtx = { ...ctx, deadline: Math.max(ctx.deadline, this.now() + this.settings.callTimeoutMs) };
      review = await this.reviewer.review(reviewCtx, { brief, typedText: request.description, images: request.images, design: state.design, generated, knowledge: state.knowledge });
    }
    const elapsedMs = state.activeMsBefore + this.now() - state.segmentStart;
    const finished: C4SketchResult = {
      ...result,
      systemName: result.systemName || brief.systemName.value,
      elapsedMs,
      intent,
      brief,
      ...(discussion !== undefined ? { discussion } : {}),
      ...(review !== undefined ? { review } : {}),
    };
    const recorded = await this.recorded(finished, request, { userText: state.userText, images: state.images, paused: false, recordBrief: state.recordBrief });
    if (recorded.discussion) ctx.sink?.discussionDone?.(recorded.discussion);
    if (recorded.review) ctx.sink?.reviewDone?.(recorded.review);
    return recorded;
  }

  /** C4_DESIGN_DISCUSSION_ENABLED and not `noDiscussion` (the user's decision 12/11: `fast` does not skip it). */
  private discussionWanted(request: C4SketchRequest): boolean {
    return this.settings.designDiscussionEnabled !== false && !request.noDiscussion;
  }

  /**
   * Writes the turn to the conversation (when one is attached): the user's text and images, the brief,
   * the diagrams, the review, as artifacts. Never fails the run.
   */
  private async recorded(result: C4SketchResult, request: C4SketchRequest, turn: { userText: string; images: PromptImage[]; paused: boolean; recordBrief: boolean }): Promise<C4SketchResult> {
    const recorder = this.deps.conversations;
    if (!recorder || !request.conversationId) return result;
    const saved = await attempt(() => recorder.record({ conversationId: request.conversationId!, ...turn, result }));
    if (!saved.ok) {
      logger.warn(`[c4] could not record the run in conversation ${request.conversationId}: ${errorMessage(saved.error)}`);
      return { ...result, conversationId: request.conversationId };
    }
    const artifacts = saved.value.artifacts ?? [];
    const reviewRef = artifacts.find((a) => a.kind === ArtifactKind.DESIGN_REVIEW);
    const discussionRef = artifacts.find((a) => a.kind === ArtifactKind.DESIGN_DISCUSSION);
    return {
      ...result,
      conversationId: request.conversationId,
      messageId: saved.value.messageId,
      ...(artifacts.length ? { artifacts } : {}),
      ...(result.review && reviewRef ? { review: { ...result.review, artifactId: reviewRef.id, alias: reviewRef.alias } } : {}),
      ...(result.discussion && discussionRef ? { discussion: { ...result.discussion, artifactId: discussionRef.id, alias: discussionRef.alias } } : {}),
    };
  }

  /** Architect (or revise) → fallback drafts → validate + render → repair → critic → report. */
  private async draw(ctx: C4RunContext, input: C4DrawInput, knowledge: CitedChunk[], activeMsBefore: number, segmentStart: number): Promise<C4SketchResult> {
    const { request, brief } = input;
    const images = this.problemImages(request.images, brief);
    const statement = briefStatement(brief, request.description);
    const base = input.revise && input.design ? this.baseSpec(input.design) : null;
    const levels = this.levelsOf(request, brief, base?.levels);
    const { maxElements } = this.settings;

    // 1. Architect: checklist + every diagram from one shared model — or the revision of the base design.
    let revision: C4Revision | undefined;
    let architectStep: string = C4Step.ARCHITECT;
    let prompt = this.prompts.architect(statement, levels, maxElements, input.answers);
    if (base && input.design) {
      architectStep = C4Step.REVISE;
      prompt = this.prompts.revise(base.json, request.description, statement, levels, maxElements);
      revision = { parentArtifactId: input.design.artifactId, version: input.design.version + 1, baseAlias: input.design.alias };
      ctx.sink?.progress(C4FlowProgress.REVISE(input.design.alias));
    } else {
      ctx.sink?.progress(C4Progress.ARCHITECT(levels.length));
    }
    const architect = await attempt(() => this.calls.askJson(ctx, prompt, images, architectStep));
    if (!architect.ok) logger.warn(`[c4] ${ctx.label} ${architectStep} failed: ${errorMessage(architect.error)}`);
    const plan = toArchitectPlan(architect.ok ? architect.value : undefined, maxElements);
    if (!plan.systemName) plan.systemName = brief.systemName.value;
    ctx.sink?.analysis({ ...plan, clarifications: [] }, sourcesOf(knowledge));

    const drawn = await this.drawLevels(ctx, statement, images, levels, plan, !request.fast);
    const deadlineHit = this.now() >= ctx.deadline;
    for (const s of drawn.states.values()) {
      if (s.result.png && deadlineHit) s.result.notes.push(C4Notes.DEADLINE);
      if (!s.result.png) s.result.error ??= s.problems[0] ?? (deadlineHit ? C4Notes.TIMED_OUT : C4Notes.NO_DIAGRAM);
    }
    const elapsedMs = activeMsBefore + this.now() - segmentStart;
    logger.info(`[c4] ${ctx.label} drawn in ${elapsedMs}ms: ${[...drawn.states].map(([level, s]) => `${level}=${s.result.png ? 'ok' : 'failed'}`).join(', ')}`);
    return {
      ...this.summary(ctx.provider, ctx.model, plan.systemName, plan.requirements, knowledge),
      levels: [...drawn.states.values()].map((s) => s.result),
      elapsedMs,
      deadlineHit,
      ...(drawn.criticNotes.length ? { criticNotes: drawn.criticNotes } : {}),
      ...(revision && drawn.states.size > 0 && [...drawn.states.values()].some((s) => s.result.png) ? { revision } : {}),
    };
  }

  /** Steps 2–4 of a draw: drafts for missing levels, render, one repair call, one critic call. */
  private async drawLevels(ctx: C4RunContext, statement: string, images: PromptImage[], levels: C4Level[], plan: C4ArchitectPlan, critic: boolean) {
    const { requirements } = plan;
    const rules: C4ValidationRules = { ...plan.rules, connectivity: this.settings.connectivityCheck !== false };
    const drafted = new Map<C4Level, C4DiagramSpec>([...plan.drafted].filter(([level]) => levels.includes(level)));
    const states = new Map<C4Level, C4LevelState>(levels.map((level) => [level, this.newState(level)]));
    const { maxElements } = this.settings;
    const requirementsJson = JSON.stringify(requirements);
    const criticNotes: string[] = [];

    // 2. Drafter fallback, in parallel, only for levels the architect left out (with the problem images).
    const missing = levels.filter((level) => !drafted.has(level));
    if (missing.length > 0) ctx.sink?.progress(C4Progress.DRAFT(missing.length));
    await Promise.all(missing.map(async (level) => {
      const draft = await attempt(() => this.calls.askJson(ctx, this.prompts.drafter(level, statement, requirementsJson, plan.modelJson, maxElements), images, C4Step.DRAFT(level)));
      if (draft.ok) drafted.set(level, toDiagramSpec(draft.value));
      else states.get(level)!.result.error = errorMessage(draft.error);
    }));

    // 3. Validate and render; validator/PlantUML problems are collected for one repair call.
    ctx.sink?.progress(C4Progress.RENDER);
    await Promise.all([...drafted].map(([level, spec]) => this.tryAccept(ctx, states.get(level)!, validateDiagram(spec, level, requirements, rules))));
    const firstConnectivity = new Map([...states].map(([level, s]) => [level, s.candidate?.connectivity.errors ?? []] as const));

    const broken = [...states].filter(([, s]) => s.candidate && s.problems.length > 0);
    if (broken.length > 0 && this.calls.timeLeft(ctx) > 0) {
      ctx.sink?.progress(C4Progress.REPAIR(broken.length));
      const input = new Map<C4Level, C4RepairInput>(broken.map(([level, s]) => [level, { specJson: JSON.stringify(s.candidate!.spec), problems: s.problems }]));
      const repaired = await attempt(() => this.calls.askJson(ctx, this.prompts.repair(input, maxElements), images, C4Step.REPAIR));
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
    if (critic && rendered.length > 0) {
      if (this.now() > ctx.criticBy) {
        for (const [, s] of rendered) s.result.notes.push(C4Notes.REVIEW_SKIPPED_LATE);
        criticNotes.push(CriticNotes.SKIPPED_LATE);
      } else {
        ctx.sink?.progress(C4Progress.CRITIC);
        criticNotes.push(...await this.critique(ctx, rendered, requirements, requirementsJson, rules));
      }
    }
    criticNotes.push(...this.countConnectivity(states, firstConnectivity));
    return { states, criticNotes };
  }

  /**
   * Counters (orphans found/repaired, errors found) and a critic note per level whose rendered spec still
   * has connectivity errors after repair/critic: the diagram is still returned (plan 04 §4.2).
   */
  private countConnectivity(states: Map<C4Level, C4LevelState>, first: Map<C4Level, readonly { code: ConnectivityCode }[]>): string[] {
    const notes: string[] = [];
    for (const [level, s] of states) {
      const initial = first.get(level) ?? [];
      const remaining = s.candidate?.connectivity.errors ?? [];
      this.connectivity.connectivityErrors += initial.length;
      if (initial.some((i) => i.code === ConnectivityCode.ORPHAN_ELEMENT)) {
        this.connectivity.orphanFound++;
        if (!remaining.some((i) => i.code === ConnectivityCode.ORPHAN_ELEMENT)) this.connectivity.orphanRepaired++;
      }
      if (s.result.png && remaining.length > 0) notes.push(CriticNotes.CONNECTIVITY(level, describeConnectivity(remaining)));
    }
    return notes;
  }

  /** The critic round; returns its findings as readable sentences. */
  private async critique(
    ctx: C4RunContext,
    rendered: Array<[C4Level, C4LevelState]>,
    requirements: C4Requirement[],
    requirementsJson: string,
    rules: C4ValidationRules,
  ): Promise<string[]> {
    const specs = new Map(rendered.map(([level, s]) => [level, JSON.stringify(s.candidate!.spec)]));
    const images: PromptImage[] = rendered.map(([, s]) => ({ data: s.result.png!, mimeType: PNG_MIME_TYPE }));
    const connectivity = new Map(rendered.map(([level, s]) => [level, s.candidate!.connectivity]));
    const critique = await attempt(() => this.calls.askJson(ctx, this.prompts.critic(specs, requirementsJson, this.settings.maxElements, connectivity), images, C4Step.CRITIC));
    if (!critique.ok) {
      logger.warn(`[c4] ${ctx.label} critic failed: ${errorMessage(critique.error)}`);
      return [CriticNotes.FAILED];
    }
    const verdicts = toCritiques(critique.value.levels);
    const notes = new Map<C4Level, string>();
    await Promise.all(rendered.map(async ([level, s]) => {
      const verdict = verdicts.get(level);
      const issues = verdict?.issues ?? [];
      if (!verdict?.revise || !verdict.spec) {
        s.result.notes.push(C4Notes.REVIEW_OK);
        notes.set(level, CriticNotes.OK(level, issues));
        return;
      }
      const validation = validateDiagram(verdict.spec, level, requirements, rules);
      if (validation.score > s.candidate!.score) {
        s.result.notes.push(C4Notes.REVIEW_REJECTED_WORSE);
        notes.set(level, CriticNotes.REJECTED_WORSE(level, issues));
      } else if (await this.tryAccept(ctx, s, validation, `${C4Notes.REVIEW_FIXED} (${issues.slice(0, 3).join('; ')})`)) {
        notes.set(level, CriticNotes.FIXED(level, issues));
      } else {
        s.result.notes.push(C4Notes.REVIEW_REJECTED_RENDER);
        notes.set(level, CriticNotes.REJECTED_RENDER(level, issues));
      }
    }));
    return rendered.map(([level]) => notes.get(level)).filter((n): n is string => !!n);
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
      spec: candidate.spec,
      elementCount: candidate.spec.elements.filter((e) => !isBoundary(e.kind)).length,
      covered: candidate.covered,
      missing: candidate.missing,
      notes: note ? [...state.result.notes, note] : state.result.notes,
      error: undefined,
      connectivity: candidate.connectivity,
    };
    ctx.sink?.level(state.result);
    return true;
  }

  /** `budgetMs` of machine time from `start`; the critic keeps the same tail it has in a full run. */
  private context(provider: AIProvider, model: string, knowledge: CitedChunk[], start: number, budgetMs: number, label: string, sink?: C4EventSink): C4RunContext {
    const deadline = start + budgetMs;
    return {
      provider,
      model,
      systemPrompt: this.prompts.system(),
      reference: this.prompts.reference(knowledge),
      deadline,
      criticBy: deadline - (this.settings.deadlineMs - this.settings.criticCutoffMs),
      label,
      sink,
    };
  }

  /** Requested levels, else the base design's levels (+ levels the change names), else the brief's / default. */
  private levelsOf(request: C4SketchRequest, brief: ProblemBrief, baseLevels?: C4Level[]): C4Level[] {
    if (request.levels.length > 0) return C4_LEVEL_ORDER.filter((level) => request.levels.includes(level));
    if (baseLevels?.length) {
      const named = levelsFromText(request.description);
      return C4_LEVEL_ORDER.filter((level) => baseLevels.includes(level) || named.includes(level));
    }
    return briefLevels(brief);
  }

  /** The base c4_spec's levels and JSON (as the architect wrote it: systemName, requirements, per-level specs). */
  private baseSpec(design: C4DesignRef): { json: string; levels: C4Level[] } | null {
    const data = design.dataJson && typeof design.dataJson === 'object' ? (design.dataJson as Record<string, unknown>) : null;
    const levels = Array.isArray(data?.levels) ? (data!.levels as Array<Record<string, unknown>>) : [];
    const parsed = levels.map((l) => l.level).filter((l): l is C4Level => typeof l === 'string' && (C4_LEVEL_ORDER as readonly string[]).includes(l));
    if (!data || parsed.length === 0) return null;
    return { json: JSON.stringify(data), levels: parsed };
  }

  /** Images of the problem statement only (the user's own design is not a statement page). */
  private problemImages(images: PromptImage[], brief: ProblemBrief): PromptImage[] {
    const design = new Set(brief.userDesign.imageIndexes);
    return images.filter((_, i) => !design.has(i));
  }

  private summary(provider: AIProvider, model: string, systemName: string, requirements: C4Requirement[], knowledge: CitedChunk[]) {
    return { provider, model, systemName, requirements, knowledgeSources: sourcesOf(knowledge) };
  }

  /** Statement notes + the user's design rules (+ the rubric for a review); RAG problems only cost the notes. */
  private async retrieveKnowledge(description: string, reviewing: boolean): Promise<CitedChunk[]> {
    const search = (query: string) => attempt(() => withTimeout(this.deps.knowledge.search(query), KNOWLEDGE_TIMEOUT_MS, 'c4-knowledge'));
    const queries = [description.trim(), DESIGN_RULES_QUERY, reviewing ? REVIEW_RUBRIC_QUERY : ''].filter(Boolean);
    const results = await Promise.all(queries.map(search));
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

