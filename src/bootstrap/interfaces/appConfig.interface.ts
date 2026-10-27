import type { AiConfig } from '../../modules/ai';
import type { C4Config } from '../../modules/c4';
import type { FileQaFolders } from '../../modules/fileqa/domain';
import type { GmailCredentials } from '../../modules/notification';
import type { HeartbeatSettings } from '../../modules/ops';
import type { RerankConfig } from '../../modules/rerank/domain';
import type { RetrievalConfig } from '../../modules/retrieval';
import type { CanvasAccountConfig } from '../../shared/canvas/interfaces/canvasAccount.interface';
import { AgentLimits } from '../../modules/agent/domain/interfaces/agentBudget.interface';
import { DatabaseSettings } from '../../shared/database/interfaces/database.interface';

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
  /** system-prompt.md */
  systemPrompt: string;
  /** knowledge.md, used when RAG is unavailable. */
  knowledgeContent: string;
}

export interface PollingConfig {
  intervalMs: number;
  autostart: boolean;
}

/** Every setting the service reads, grouped by the module that consumes it. */
export interface AppConfig {
  http: HttpConfig;
  accounts: CanvasAccountConfig[];
  canvasFolders: FileQaFolders;
  polling: PollingConfig;
  prompts: PromptConfig;
  ai: AiConfig;
  /** Null without PINECONE_API_KEY: no RAG, no agent search, vault files are stored but not indexed. */
  retrieval: RetrievalConfig | null;
  rerank: RerankConfig;
  agent: AgentLimits;
  /** /api/c4 (C4 Sketcher). */
  c4: C4Config;
  /** Neon (prod) or local JSON files — shared by the vault manifest and poll cursors. */
  database: DatabaseSettings;
  gmail: GmailCredentials;
  heartbeat: HeartbeatSettings;
}
