import { AgentToolName, type AgentBudget } from '../domain';
import { RESEARCH_MODE_FALLBACK, RESEARCH_MODE_PLACEHOLDER } from './constants/agentPrompt.constants';

/**
 * Static system prompt + the research-mode overlay (`prompts/skills/agent/research-mode.md`, 12/11 02 Bước 2).
 * The code only fills the placeholders; without the registry the built-in copy of that file is used.
 */
export function buildAgentSystemPrompt(basePrompt: string, budget: AgentBudget, template?: string | null): string {
  return `${basePrompt}\n\n${renderResearchMode(template?.trim() || RESEARCH_MODE_FALLBACK, budget)}`;
}

export function renderResearchMode(template: string, budget: AgentBudget): string {
  return template
    .replaceAll(RESEARCH_MODE_PLACEHOLDER.MAX_TOOL_CALLS, String(budget.maxToolCalls))
    .replaceAll(RESEARCH_MODE_PLACEHOLDER.MAX_DIAGRAM_VALIDATIONS, String(budget.maxDiagramValidations ?? 0));
}

export { AgentToolName };
