import type { AIInvocationService, PromptCacheLayout } from '../../ai';
import type { RerankModule } from '../../rerank';
import type { RetrievalModule } from '../../retrieval';
import type { VaultRepository } from '../../vault';
import type { AnswerService } from '../application/answer.service';
import type { ClientAnswerService } from '../application/clientAnswer.service';
import type { AgentLimits, AgentToolName, ToolCallingModelFactory } from '../domain';
import type { VaultDocumentSource } from '../infrastructure/tools/readDocument.tool';
import type { VaultSearcher } from '../infrastructure/interfaces/vaultSearch.interface';

export interface AgentModuleConfig {
  limits: AgentLimits;
  /** Course system prompt (system-prompt.md); the research instructions are appended to it. */
  systemPrompt: string;
  /** PROMPT_CACHE_LAYOUT (note 18): where conversation memory goes; default v2. */
  promptLayout?: PromptCacheLayout;
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
}

export interface AgentModule {
  answers: AnswerService;
  /** `answers` with the final text formatted for client rendering (math + Mermaid); for chat API and Canvas replies. */
  clientAnswers: ClientAnswerService;
  enabled: boolean;
}
