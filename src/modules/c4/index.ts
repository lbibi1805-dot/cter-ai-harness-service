import { Router } from '../../shared/http/router';
import { logger } from '../../shared/logging/logger';
import { C4SketchService } from './application/c4Sketch.service';
import { CRITIC_CUTOFF_RATIO, DEFAULT_C4_DESIGN_DISCUSSION_ENABLED, DEFAULT_DIAGRAM_CONNECTIVITY_CHECK, MAX_C4_DEADLINE_MS, MIN_C4_DEADLINE_MS } from './application/constants/c4Sketch.constants';
import { ConversationC4SessionRepository } from './infrastructure/conversationC4Session.repository';
import { ObjectStorageC4ImageStaging } from './infrastructure/objectStorageC4ImageStaging.adapter';
import { MAX_MAX_ELEMENTS, MIN_MAX_ELEMENTS } from './domain';
import { AIInvocationModelAdapter } from './infrastructure/aiInvocationModel.adapter';
import { InMemoryC4SessionRepository } from './infrastructure/inMemoryC4Session.repository';
import { PlantUmlRendererAdapter } from './infrastructure/plantUmlRenderer.adapter';
import { RagKnowledgeAdapter } from './infrastructure/ragKnowledge.adapter';
import { C4Controller } from './presentation/c4.controller';
import { C4RenderController } from './presentation/c4Render.controller';
import { C4RenderService } from './application/c4Render.service';
import { createC4Routes } from './presentation/c4.routes';
import type { C4ModuleConfig, C4ModuleDeps, C4Module } from './interfaces/c4Module.interface';

export type { C4Config, C4ModuleConfig, C4ModuleDeps, C4Module } from './interfaces/c4Module.interface';

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
      designDiscussionEnabled: config.designDiscussionEnabled ?? DEFAULT_C4_DESIGN_DISCUSSION_ENABLED,
      connectivityCheck: config.connectivityCheck ?? DEFAULT_DIAGRAM_CONNECTIVITY_CHECK,
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
  return { router: new Router(createC4Routes(new C4Controller(service, deps.uploads ?? null, config.maxImages), new C4RenderController(render)), config.chatApiToken), service, render };
}

export { C4SketchService } from './application/c4Sketch.service';
export { C4RenderService, type C4RenderResult } from './application/c4Render.service';
export { MAX_RENDER_SOURCE_CHARS } from './application/constants/c4Render.constants';
export { C4_OPENAPI_PATHS } from './presentation/constants/c4OpenApi.constants';
export { C4PumlBuilder } from './application/c4Puml.builder';
export { DEFAULT_C4_INCLUDE_BASE } from './application/constants/c4Puml.constants';
export { DEFAULT_C4_CALL_TIMEOUT_MS, DEFAULT_C4_DEADLINE_MS, DEFAULT_C4_DESIGN_DISCUSSION_ENABLED, DEFAULT_DIAGRAM_CONNECTIVITY_CHECK } from './application/constants/c4Sketch.constants';
export { lintPlantUmlConnectivity, checkConnectivity, ensureDiscussionFrame, discussionTopicsPresent, ConnectivityCode, toDiagramSpec, DISCUSSION_SECTIONS } from './domain';
export type { ConnectivityIssue, ConnectivityReport } from './domain';
export type { C4ResumeRequest, C4SketchRequest, C4SketchResult, C4Session, C4EventSink, C4ReviewResult, C4Clarify, C4ImageStaging, C4StagedImage, C4DiscussionResult, C4ConnectivityStats } from './application/interfaces/c4Sketch.interface';
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
