import { logger } from '../../shared/logging/logger';
import type { AIInvocationService } from '../ai';
import type { RerankModule } from '../rerank';
import type { RetrievalModule } from '../retrieval';
import type { VaultRepository } from '../vault';
import { buildAgentSystemPrompt } from './application/agentPrompt.builder';
import { AgentRunner } from './application/agentRunner.service';
import { AnswerService } from './application/answer.service';
import { AgentToolName, buildAgentBudget, type AgentLimits, type ToolCallingModelFactory } from './domain';
import { RagVaultSearcher } from './infrastructure/ragVaultSearcher.adapter';
import { ListFolderTool } from './infrastructure/tools/listFolder.tool';
import { ReadDocumentTool } from './infrastructure/tools/readDocument.tool';
import { VaultSearchTool } from './infrastructure/tools/vaultSearch.tool';
import { AgentCapability } from './application/interfaces/answer.interface';
import { VaultSearcher } from './infrastructure/interfaces/vaultSearch.interface';

export interface AgentModuleConfig {
  limits: AgentLimits;
  /** Course system prompt (system-prompt.md); the research instructions are appended to it. */
  systemPrompt: string;
}

export interface AgentModuleDeps {
  singleShot: AIInvocationService;
  vaultRepository: VaultRepository;
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
  enabled: boolean;
}

/**
 * Agent mode needs a tool-calling model and vault search. Without either,
 * every agent request is answered single-shot (with a fallback reason).
 */
export function createAgentModule(config: AgentModuleConfig, deps: AgentModuleDeps): AgentModule {
  const capability = buildCapability(config, deps);
  if (!capability) logger.info('[agent] agent mode disabled (needs a tool-calling model and PINECONE_API_KEY) — agent requests will be answered single-shot');
  return { answers: new AnswerService(deps.singleShot, capability), enabled: capability !== null };
}

function buildCapability(config: AgentModuleConfig, deps: AgentModuleDeps): AgentCapability | null {
  const searcher = deps.searcher ?? (deps.retrieval ? new RagVaultSearcher(deps.retrieval, deps.ranking) : null);
  if (!searcher || !deps.createModel) return null;

  const budget = buildAgentBudget(config.limits);
  const tools = [new VaultSearchTool(searcher), new ReadDocumentTool(deps.vaultRepository), new ListFolderTool(deps.vaultRepository)]
    .filter((tool) => !deps.disabledTools?.includes(tool.name));
  return {
    runner: new AgentRunner(tools, budget),
    createModel: deps.createModel,
    systemPrompt: buildAgentSystemPrompt(config.systemPrompt, budget),
  };
}

export { AgentRunner } from './application/agentRunner.service';
export { AnswerService } from './application/answer.service';
export * from './domain';
export { ChatCompletionsToolModel } from './infrastructure/toolModels/chatCompletionsToolModel.adapter';
export { OpenAIResponsesToolModel } from './infrastructure/toolModels/openaiResponsesToolModel.adapter';
export {
  createOpenAIToolModelFactory,
  createOpenRouterToolModelFactory,
  createToolCallingModelFactory
} from './infrastructure/toolModels/toolCallingModel.factory';
