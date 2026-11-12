import { logger } from '../../shared/logging/logger';
import { buildAgentSystemPrompt } from './application/agentPrompt.builder';
import { AgentRunner } from './application/agentRunner.service';
import { AnswerService } from './application/answer.service';
import { ClientAnswerService } from './application/clientAnswer.service';
import { buildAgentBudget, type AgentTool } from './domain';
import { RagVaultSearcher } from './infrastructure/ragVaultSearcher.adapter';
import { ListFolderTool } from './infrastructure/tools/listFolder.tool';
import { ReadDocumentTool } from './infrastructure/tools/readDocument.tool';
import { VaultSearchTool } from './infrastructure/tools/vaultSearch.tool';
import { ValidateDiagramTool } from './infrastructure/tools/validateDiagram.tool';
import { DiagramSyntaxGuard } from './application/diagramSyntaxGuard.service';
import { AgentCapability } from './application/interfaces/answer.interface';
import type { AgentModule, AgentModuleConfig, AgentModuleDeps } from './interfaces/agentModule.interface';

export type { AgentModule, AgentModuleConfig, AgentModuleDeps } from './interfaces/agentModule.interface';

/**
 * Agent mode needs a tool-calling model and vault search. Without either,
 * every agent request is answered single-shot (with a fallback reason).
 */
export function createAgentModule(config: AgentModuleConfig, deps: AgentModuleDeps): AgentModule {
  const capability = buildCapability(config, deps);
  if (!capability) logger.info('[agent] agent mode disabled (needs a tool-calling model and PINECONE_API_KEY) — agent requests will be answered single-shot');
  const answers = new AnswerService(deps.singleShot, capability, Date.now, config.promptLayout);
  const diagramGuard = deps.diagramValidator && config.diagramGuard?.enabled
    ? new DiagramSyntaxGuard(config.diagramGuard, deps.diagramValidator, deps.diagramRepairer ?? null)
    : null;
  return { answers, clientAnswers: new ClientAnswerService(answers, diagramGuard), enabled: capability !== null, diagramGuard };
}

function buildCapability(config: AgentModuleConfig, deps: AgentModuleDeps): AgentCapability | null {
  const searcher = deps.searcher ?? (deps.retrieval ? new RagVaultSearcher(deps.retrieval, deps.ranking) : null);
  if (!searcher || !deps.createModel) return null;

  const budget = buildAgentBudget(config.limits);
  const tools: AgentTool[] = [new VaultSearchTool(searcher), new ReadDocumentTool(deps.vaultDocuments), new ListFolderTool(deps.vaultRepository)];
  // No renderer → no validate_diagram tool (12/11 plan 03 §4); the guard may still run.
  if (deps.diagramValidator && (budget.maxDiagramValidations ?? 0) > 0) tools.push(new ValidateDiagramTool(deps.diagramValidator));
  const enabledTools = tools.filter((tool) => !deps.disabledTools?.includes(tool.name));
  return {
    runner: new AgentRunner(enabledTools, budget),
    createModel: deps.createModel,
    systemPrompt: buildAgentSystemPrompt(config.systemPrompt, budget, config.researchMode),
    reminder: config.reminder,
  };
}

export { AgentRunner } from './application/agentRunner.service';
export { AnswerService } from './application/answer.service';
export { ClientAnswerService } from './application/clientAnswer.service';
export { DiagramSyntaxGuard } from './application/diagramSyntaxGuard.service';
export { ValidateDiagramTool, describeSyntaxError } from './infrastructure/tools/validateDiagram.tool';
export type { DiagramGuardSettings, DiagramGuardStats } from './application/interfaces/diagramGuard.interface';
export { DEFAULT_AGENT_MAX_DIAGRAM_VALIDATIONS, DEFAULT_DIAGRAM_GUARD_ENABLED, DEFAULT_DIAGRAM_MAX_REPAIRS } from './application/constants/diagramGuard.constants';
export * from './domain';
export { ChatCompletionsToolModel } from './infrastructure/toolModels/chatCompletionsToolModel.adapter';
export { OpenAIResponsesToolModel } from './infrastructure/toolModels/openaiResponsesToolModel.adapter';
export {
  createOpenAIToolModelFactory,
  createOpenRouterToolModelFactory,
  createToolCallingModelFactory
} from './infrastructure/toolModels/toolCallingModel.factory';
export { AiDiagramRepairer } from './infrastructure/aiDiagramRepairer.adapter';
