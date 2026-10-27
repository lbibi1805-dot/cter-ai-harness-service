import { Router } from '../../shared/http/router';
import { logger } from '../../shared/logging/logger';
import type { AIInvocationService, ModelCatalog } from '../ai';
import type { ChunkRetriever } from '../rerank';
import { C4SketchService } from './application/c4Sketch.service';
import { CRITIC_CUTOFF_RATIO, MAX_C4_DEADLINE_MS, MIN_C4_DEADLINE_MS } from './application/constants/c4Sketch.constants';
import type { C4KnowledgeSource, C4ModelGateway, C4SessionRepository } from './application/interfaces/c4Sketch.interface';
import { MAX_MAX_ELEMENTS, MIN_MAX_ELEMENTS, type DiagramRenderer } from './domain';
import { AIInvocationModelAdapter } from './infrastructure/aiInvocationModel.adapter';
import { InMemoryC4SessionRepository } from './infrastructure/inMemoryC4Session.repository';
import { PlantUmlRendererAdapter } from './infrastructure/plantUmlRenderer.adapter';
import { RagKnowledgeAdapter } from './infrastructure/ragKnowledge.adapter';
import { C4Controller } from './presentation/c4.controller';
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
}

export interface C4Module {
  router: Router;
  service: C4SketchService;
}

/** `POST /api/c4`: C4 Sketcher (problem statement → C4 diagrams as PNG). */
export function createC4Module(config: C4ModuleConfig, deps: C4ModuleDeps): C4Module {
  const enabled = !!config.chatApiToken;
  if (!enabled) logger.info('[c4] CHAT_API_TOKEN not set — /api/c4 disabled');
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
      sessions: deps.sessions ?? new InMemoryC4SessionRepository(deps.now),
      model: deps.model ?? new AIInvocationModelAdapter(deps.invocation),
      knowledge: deps.knowledge ?? new RagKnowledgeAdapter(deps.currentRetriever),
      renderer: deps.renderer ?? new PlantUmlRendererAdapter(config.plantUmlServerUrl),
      puml: { includeBase: config.includeBase, showLegend: config.showLegend },
      now: deps.now,
    },
  );
  return { router: new Router(createC4Routes(new C4Controller(service)), config.chatApiToken), service };
}

export { C4SketchService } from './application/c4Sketch.service';
export { C4PumlBuilder } from './application/c4Puml.builder';
export { DEFAULT_C4_INCLUDE_BASE } from './application/constants/c4Puml.constants';
export { DEFAULT_C4_CALL_TIMEOUT_MS, DEFAULT_C4_DEADLINE_MS } from './application/constants/c4Sketch.constants';
export type { C4ResumeRequest, C4SketchRequest, C4SketchResult } from './application/interfaces/c4Sketch.interface';
export { DEFAULT_MAX_ELEMENTS } from './domain';
export { DEFAULT_PLANTUML_SERVER_URL } from './infrastructure/constants/plantUml.constants';
export { encodePlantUml, decodePlantUml } from './infrastructure/helpers/plantUmlEncoding.helper';
export { PlantUmlRendererAdapter } from './infrastructure/plantUmlRenderer.adapter';
export { C4ApiPath } from './presentation/enums/c4.enums';
