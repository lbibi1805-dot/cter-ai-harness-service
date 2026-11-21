import type { Router } from '../../../shared/http/router';
import type { AIInvocationService, ModelCatalog } from '../../ai';
import type { ChunkRetriever } from '../../rerank';
import type { C4SketchService } from '../application/c4Sketch.service';
import type { C4AuxGateway, C4ConversationRecorder, C4KnowledgeSource, C4ModelGateway, C4SessionRepository, C4SkillSource } from '../application/interfaces/c4Sketch.interface';
import type { ResolverSettings } from '../../context';
import type { IntentRouter } from '../../routing';
import type { ConversationStore } from '../../conversation-store';
import type { ObjectStorage } from '../../../shared/storage';
import type { DiagramRenderer } from '../domain';
import type { StagedImageService } from '../../chat/application/stagedImages.service';
import type { C4RenderService } from '../application/c4Render.service';

/** The C4_* settings (AppConfig.c4). */
export interface C4Config {
  plantUmlServerUrl: string;
  /** C4-PlantUML base URL, or "stdlib". */
  includeBase: string;
  deadlineMs: number;
  callTimeoutMs: number;
  maxElements: number;
  showLegend: boolean;
  /** C4_DESIGN_DISCUSSION_ENABLED (default true): discussion writer step T1–T7 (12/11 plan 04 §5.3). */
  designDiscussionEnabled?: boolean;
  /** DIAGRAM_CONNECTIVITY_CHECK (default true): connectivity rules C1–C11 (plan 04 §4). */
  connectivityCheck?: boolean;
}

export interface C4ModuleConfig extends C4Config {
  /** Bearer token shared with `/api/chat`; unset disables the API (fails closed). */
  chatApiToken?: string;
  /** MAX_CHAT_IMAGES (chat limits); absent = DEFAULT_MAX_CHAT_IMAGES. */
  maxImages?: number;
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
