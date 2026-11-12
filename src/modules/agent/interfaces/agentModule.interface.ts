import type { AIInvocationService, PromptCacheLayout } from '../../ai';
import type { RerankModule } from '../../rerank';
import type { RetrievalModule } from '../../retrieval';
import type { VaultRepository } from '../../vault';
import type { AnswerService } from '../application/answer.service';
import type { ClientAnswerService } from '../application/clientAnswer.service';
import type { DiagramSyntaxGuard } from '../application/diagramSyntaxGuard.service';
import type { AgentLimits, AgentToolName, DiagramRepairer, DiagramValidator, ToolCallingModelFactory } from '../domain';
import type { DiagramGuardSettings } from '../application/interfaces/diagramGuard.interface';
import type { VaultDocumentSource } from '../infrastructure/tools/readDocument.tool';
import type { VaultSearcher } from '../infrastructure/interfaces/vaultSearch.interface';

export interface AgentModuleConfig {
  limits: AgentLimits;
  /** Static system prompt (registry composition); the research-mode overlay is appended to it. */
  systemPrompt: string;
  /** `prompts/skills/agent/research-mode.md` body (placeholders unfilled); null = the built-in fallback. */
  researchMode?: string | null;
  /** `prompts/policies/reminder.md`, appended after the question. */
  reminder?: string;
  /** PROMPT_CACHE_LAYOUT (note 18): where conversation memory goes; default v2. */
  promptLayout?: PromptCacheLayout;
  /** DIAGRAM_SYNTAX_GUARD_ENABLED / DIAGRAM_SYNTAX_MAX_REPAIRS (12/11 plan 03 §5); absent = guard off. */
  diagramGuard?: DiagramGuardSettings;
}

export interface AgentModuleDeps {
  singleShot: AIInvocationService;
  vaultRepository: VaultRepository;
  /** File content for `read_document` (the vault service reads object storage). */
  vaultDocuments: VaultDocumentSource;
  /** Null when no tool-calling model is reachable with the configured credentials. */
  createModel: ToolCallingModelFactory | null;
  /** Null when Pinecone is not configured (the agent cannot search). */
  retrieval: RetrievalModule | null;
  /** Reorders search_vault candidates; omitted = cosine order. */
  ranking?: RerankModule;
  /** Test hook; production searches through `retrieval`. */
  searcher?: VaultSearcher;
  /** Eval-only ablation: tools to leave out (e.g. read_document). */
  disabledTools?: AgentToolName[];
  /** Renders PlantUML (C4RenderService); null = no `validate_diagram` tool and no guard. */
  diagramValidator?: DiagramValidator | null;
  /** Aux-model repair of a broken block (guard); null = the guard only reports. */
  diagramRepairer?: DiagramRepairer | null;
}

export interface AgentModule {
  answers: AnswerService;
  /** `answers` with the final text formatted for client rendering (math + Mermaid); for chat API and Canvas replies. */
  clientAnswers: ClientAnswerService;
  enabled: boolean;
  /** Diagram syntax guard (null when off): stats for `/api/metrics/latency`. */
  diagramGuard: DiagramSyntaxGuard | null;
}
