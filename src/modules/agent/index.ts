import type { AIInvocationService } from '../ai';
import type { VaultRepository } from '../vault';
import type { RerankModule } from '../rerank';
import type { AppConfig } from '../../types';
import { logger } from '../../utils/logger';
import { buildAgentSystemPrompt } from './application/agentPrompt';
import { AgentRunner } from './application/agentRunner.service';
import { AnswerService, type AgentCapability } from './application/answer.service';
import { DEFAULT_AGENT_BUDGET, type AgentBudget, type ToolCallingModelFactory } from './domain';
import { createOpenAIToolModelFactory } from './infrastructure/openaiResponsesToolModel';
import { RagVaultSearcher } from './infrastructure/ragVaultSearcher';
import { ListFolderTool } from './infrastructure/tools/listFolder.tool';
import { ReadDocumentTool } from './infrastructure/tools/readDocument.tool';
import { VaultSearchTool, type VaultSearcher } from './infrastructure/tools/vaultSearch.tool';

export interface AgentModuleDeps {
  ai: AIInvocationService;
  vaultRepository: VaultRepository;
  /** Reorders search_vault candidates; omitted = cosine order. */
  ranking?: RerankModule;
  /** Test hooks; production builds the OpenAI factory and Pinecone searcher from config. */
  createModel?: ToolCallingModelFactory;
  searcher?: VaultSearcher;
}

export interface AgentModule {
  answers: AnswerService;
  enabled: boolean;
}

/**
 * Agent mode needs an OpenAI key (tool-calling model) and the vault/Pinecone
 * config (search). Without them every `_agent` request falls back to single-shot.
 */
export function createAgentModule(config: AppConfig, deps: AgentModuleDeps): AgentModule {
  const capability = buildCapability(config, deps);
  if (!capability) logger.info('[agent] agent mode disabled (needs OPENAI_API_KEY and PINECONE_API_KEY) — `_agent` requests will be answered single-shot');
  return { answers: new AnswerService(deps.ai, capability), enabled: capability !== null };
}

function buildCapability(config: AppConfig, deps: AgentModuleDeps): AgentCapability | null {
  const searcher = deps.searcher ?? (config.vaultConfig ? new RagVaultSearcher(config.vaultConfig, config.aiKeys, deps.ranking) : null);
  const createModel = deps.createModel
    ?? (config.aiKeys.openai ? createOpenAIToolModelFactory({ apiKey: config.aiKeys.openai, timeoutMs: config.aiTimeoutMs }) : null);
  if (!searcher || !createModel) return null;

  const budget: AgentBudget = { ...DEFAULT_AGENT_BUDGET, ...config.agent };
  budget.minToolCalls = Math.max(0, Math.min(budget.minToolCalls, budget.maxToolCalls));
  const tools = [new VaultSearchTool(searcher), new ReadDocumentTool(deps.vaultRepository), new ListFolderTool(deps.vaultRepository)];
  return {
    runner: new AgentRunner(tools, budget),
    createModel,
    systemPrompt: buildAgentSystemPrompt(config.systemPrompt, budget),
  };
}

export { AnswerService } from './application/answer.service';
export { AgentRunner } from './application/agentRunner.service';
export * from './domain';
