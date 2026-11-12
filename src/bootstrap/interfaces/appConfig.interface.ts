import type { EssaySettings } from '../../modules/essay';
import type { AiConfig } from '../../modules/ai';
import type { C4Config } from '../../modules/c4';
import type { FileQaFolders } from '../../modules/fileqa/domain';
import type { GmailCredentials } from '../../modules/notification';
import type { HeartbeatSettings } from '../../modules/ops';
import type { RerankConfig } from '../../modules/rerank/domain';
import type { RetrievalConfig } from '../../modules/retrieval';
import type { CanvasAccountConfig } from '../../shared/canvas/interfaces/canvasAccount.interface';
import { AgentLimits } from '../../modules/agent/domain/interfaces/agentBudget.interface';
import type { DiagramGuardSettings } from '../../modules/agent/application/interfaces/diagramGuard.interface';
import { DatabaseSettings } from '../../shared/database/interfaces/database.interface';
import type { ObjectStorageSettings } from '../../shared/storage';
import type { AIProvider } from '../../modules/ai';
import type { AuxTimeouts, ContextSettings } from '../../modules/context';
import type { ChatLimits } from '../../modules/chat';
import type { PromptRegistry } from '../../modules/prompts';

export interface ContextAppConfig {
  /** CONVERSATION_STORE_ENABLED: server-side conversations + context engineering on /api/chat and /api/c4. */
  conversationStoreEnabled: boolean;
  purgeDays: number;
  settings: ContextSettings;
  aux: { provider: AIProvider; model: string };
  timeouts: AuxTimeouts;
}

export interface HttpConfig {
  port: number;
  /** Bearer token for write endpoints; unset means open (legacy behaviour). */
  adminToken?: string;
  /** Bearer token for `/api/chat` and `/api/retrieve`; unset disables them (fails closed). */
  chatApiToken?: string;
  /** FRONTEND_URL / ALLOWED_ORIGINS; empty allows every origin. */
  corsOrigins: string[];
}

export interface PromptConfig {
  /** Static system prompt (layer ①): the PromptRegistry composition, or system-prompt.md when the registry is off. */
  systemPrompt: string;
  /** knowledge.md, used when RAG is unavailable. */
  knowledgeContent: string;
  /** Short sha256 of `systemPrompt` (for `messages.prompt_version`, logs, eval result names). */
  promptVersion?: string;
  /** Null/absent when PROMPT_REGISTRY_ENABLED=false or `prompts/` is missing; domains and skills are read from it. */
  registry?: PromptRegistry | null;
  /** `prompts/policies/reminder.md` (built-in copy without the registry): appended after the question on every path. */
  reminder?: string;
  /** `prompts/skills/agent/research-mode.md`; null = the agent module's built-in copy. */
  researchMode?: string | null;
  /** /c4 shared rules: precedence + domain system-architecture (null without the registry). */
  c4Rules?: string | null;
  /** `prompts/policies/diagram-syntax.md`: system prompt of the diagram repair call (null without the registry). */
  diagramSyntax?: string | null;
}

export interface PollingConfig {
  intervalMs: number;
  autostart: boolean;
  /** POLL_CURSOR_FLUSH_MS: Neon poll cursors live in RAM and are flushed at most this often (default 15 min). */
  cursorFlushMs?: number;
}

/** Every setting the service reads, grouped by the module that consumes it. */
export interface AppConfig {
  http: HttpConfig;
  accounts: CanvasAccountConfig[];
  canvasFolders: FileQaFolders;
  polling: PollingConfig;
  prompts: PromptConfig;
  /** `/api/chat` limits (MAX_CHAT_IMAGES, CHAT_MAX_BODY_MB, GEMINI_INLINE_IMAGES_MAX_MB); absent = defaults. */
  chat?: ChatLimits;
  ai: AiConfig;
  /** Null without PINECONE_API_KEY: no RAG, no agent search, vault files are stored but not indexed. */
  retrieval: RetrievalConfig | null;
  rerank: RerankConfig;
  agent: AgentLimits;
  /** DIAGRAM_SYNTAX_GUARD_ENABLED / DIAGRAM_SYNTAX_MAX_REPAIRS (12/11 plan 03 §5). */
  diagramGuard?: DiagramGuardSettings;
  /** /api/c4 (C4 Sketcher). */
  c4: C4Config;
  /** Neon (prod) or local JSON files — shared by the vault manifest and poll cursors. */
  database: DatabaseSettings;
  /** R2 (prod) or a local directory (dev): vault files and conversation artifacts. */
  storage: ObjectStorageSettings;
  context: ContextAppConfig;
  /** ESSAY_* (note 15): Essay Mode on /api/chat. */
  essay: EssaySettings;
  gmail: GmailCredentials;
  heartbeat: HeartbeatSettings;
}
