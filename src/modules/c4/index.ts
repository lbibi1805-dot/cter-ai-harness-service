import { Router } from '../../shared/http/router';
import { logger } from '../../shared/logging/logger';
import type { AIInvocationService, ModelCatalog } from '../ai';
import type { ChunkRetriever } from '../rerank';
import { C4SketchService } from './application/c4Sketch.service';
import { CRITIC_CUTOFF_RATIO, MAX_C4_DEADLINE_MS, MIN_C4_DEADLINE_MS } from './application/constants/c4Sketch.constants';
import type { C4AuxGateway, C4ConversationRecorder, C4KnowledgeSource, C4ModelGateway, C4SessionRepository, C4SkillSource } from './application/interfaces/c4Sketch.interface';
import type { ResolverSettings } from '../context';
import type { IntentRouter } from '../routing';
import type { ConversationStore } from '../conversation-store';
import type { ObjectStorage } from '../../shared/storage';
import { ConversationC4SessionRepository } from './infrastructure/conversationC4Session.repository';
import { ObjectStorageC4ImageStaging } from './infrastructure/objectStorageC4ImageStaging.adapter';
import { MAX_MAX_ELEMENTS, MIN_MAX_ELEMENTS, type DiagramRenderer } from './domain';
import { AIInvocationModelAdapter } from './infrastructure/aiInvocationModel.adapter';
import { InMemoryC4SessionRepository } from './infrastructure/inMemoryC4Session.repository';
import { PlantUmlRendererAdapter } from './infrastructure/plantUmlRenderer.adapter';
import { RagKnowledgeAdapter } from './infrastructure/ragKnowledge.adapter';
import { C4Controller } from './presentation/c4.controller';
import type { StagedImageService } from '../chat/application/stagedImages.service';
import { C4RenderController } from './presentation/c4Render.controller';
import { C4RenderService } from './application/c4Render.service';
import { createC4Routes } from './presentation/c4.routes';

/** The C4_* settings (AppConfig.c4). */
export interface C4Config {
  plantUmlServerUrl: string;
  /** C4-PlantUML base URL, or "stdlib". */
  includeBase: string;
  deadlineMs: number;
  callTimeoutMs: number;
  maxElements: number;
  showLegend: boolean;
}

export interface C4ModuleConfig extends C4Config {
  /** Bearer token shared with `/api/chat`; unset disables the API (fails closed). */
  chatApiToken?: string;
}

export interface C4ModuleDeps {
  /** Upload-first images (chat module): `imageIds` in POST /api/c4. */
  uploads?: StagedImageService | null;
  invocation: AIInvocationService;
  catalog: ModelCatalog;
  /** The production RAG retriever once the vault is indexed, else null. */
  currentRetriever: () => ChunkRetriever | null;
  /** Test hooks; production uses the AI module, the vault RAG and the PlantUML server. */
  model?: C4ModelGateway;
  knowledge?: C4KnowledgeSource;
  renderer?: DiagramRenderer;
  sessions?: C4SessionRepository;
  now?: () => number;
  /** Conversation store: paused runs persist in `conversations.state` (survive restarts). */
  conversationStore?: ConversationStore | null;
  /** Object storage for the images of paused runs (`tmp/c4-pending/`), so a resume after a restart keeps them. */
  imageStorage?: ObjectStorage | null;
  /** Records runs in conversations (context module). */
  conversations?: C4ConversationRecorder | null;
  /** Intent router (routing module): rules + the combined aux call. Absent = rules only. */
  router?: IntentRouter | null;
  /** Aux model for parsing the user's clarify reply. Absent = numbered answers / defaults. */
  aux?: C4AuxGateway | null;
  /** Prompt registry lookup (`prompts/skills/c4/*.md`); absent = the built-in constants. */
  skills?: C4SkillSource | null;
  /** Precedence + domain system-architecture from the registry (12/11 02 Bước 4); absent = none. */
  sharedRules?: string | null;
  /** `prompts/policies/reminder.md`. */
  reminder?: string;
  /** Shared `POST /api/c4/render` service (its RAM cache also serves the diagram guard); absent = a new one. */
  render?: C4RenderService;
  /** ARTIFACT_RESOLVER_* settings (which design a revise/review is about). */
  resolver?: Partial<ResolverSettings>;
}

export interface C4Module {
  router: Router;
  service: C4SketchService;
  /** `POST /api/c4/render`: PlantUML preview with a RAM cache (no DB/R2). */
  render: C4RenderService;
}

/** `POST /api/c4`: C4 Sketcher (problem statement → C4 diagrams as PNG); `POST /api/c4/render`: PlantUML preview. */
export function createC4Module(config: C4ModuleConfig, deps: C4ModuleDeps): C4Module {
  const enabled = !!config.chatApiToken;
  if (!enabled) logger.info('[c4] CHAT_API_TOKEN not set — /api/c4 disabled');
  const renderer = deps.renderer ?? new PlantUmlRendererAdapter(config.plantUmlServerUrl);
  const deadlineMs = Math.min(MAX_C4_DEADLINE_MS, Math.max(MIN_C4_DEADLINE_MS, config.deadlineMs));
  const service = new C4SketchService(
    {
      enabled,
      deadlineMs,
      criticCutoffMs: deadlineMs * CRITIC_CUTOFF_RATIO,
      callTimeoutMs: config.callTimeoutMs,
      maxElements: Math.min(MAX_MAX_ELEMENTS, Math.max(MIN_MAX_ELEMENTS, config.maxElements)),
    },
    {
      catalog: deps.catalog,
      sessions: deps.sessions ?? (deps.conversationStore
        ? new ConversationC4SessionRepository(
          new InMemoryC4SessionRepository(deps.now), deps.conversationStore, deps.now,
          deps.imageStorage ? new ObjectStorageC4ImageStaging(deps.imageStorage) : null,
        )
        : new InMemoryC4SessionRepository(deps.now)),
      ...(deps.conversations ? { conversations: deps.conversations } : {}),
      router: deps.router ?? null,
      aux: deps.aux ?? null,
      skills: deps.skills ?? null,
      sharedRules: deps.sharedRules ?? null,
      reminder: deps.reminder ?? '',
      ...(deps.resolver ? { resolver: deps.resolver } : {}),
      model: deps.model ?? new AIInvocationModelAdapter(deps.invocation),
      knowledge: deps.knowledge ?? new RagKnowledgeAdapter(deps.currentRetriever),
      renderer,
      puml: { includeBase: config.includeBase, showLegend: config.showLegend },
      now: deps.now,
    },
  );
  const render = deps.render ?? new C4RenderService(enabled, renderer);
  return { router: new Router(createC4Routes(new C4Controller(service, deps.uploads ?? null), new C4RenderController(render)), config.chatApiToken), service, render };
}

export { C4SketchService } from './application/c4Sketch.service';
export { C4RenderService, type C4RenderResult } from './application/c4Render.service';
export { MAX_RENDER_SOURCE_CHARS } from './application/constants/c4Render.constants';
export { C4_OPENAPI_PATHS } from './presentation/constants/c4OpenApi.constants';
export { C4PumlBuilder } from './application/c4Puml.builder';
export { DEFAULT_C4_INCLUDE_BASE } from './application/constants/c4Puml.constants';
export { DEFAULT_C4_CALL_TIMEOUT_MS, DEFAULT_C4_DEADLINE_MS } from './application/constants/c4Sketch.constants';
export type { C4ResumeRequest, C4SketchRequest, C4SketchResult, C4Session, C4EventSink, C4ReviewResult, C4Clarify, C4ImageStaging, C4StagedImage } from './application/interfaces/c4Sketch.interface';
export { ObjectStorageC4ImageStaging } from './infrastructure/objectStorageC4ImageStaging.adapter';
export { C4_PENDING_IMAGE_PREFIX } from './infrastructure/constants/c4ImageStaging.constants';
export { C4SkillId } from './application/enums/c4Skill.enums';
export { C4BriefService, toSlotAnswers } from './application/c4Brief.service';
export { C4StreamEvent } from './presentation/enums/c4.enums';
export { DEFAULT_MAX_ELEMENTS } from './domain';
export { DEFAULT_PLANTUML_SERVER_URL } from './infrastructure/constants/plantUml.constants';
export { encodePlantUml, decodePlantUml } from './infrastructure/helpers/plantUmlEncoding.helper';
export { PlantUmlRendererAdapter } from './infrastructure/plantUmlRenderer.adapter';
export { C4ApiPath } from './presentation/enums/c4.enums';
