import type { CitedChunk } from '../../../retrieval/domain/interfaces/retrieval.interface';
import { type AgentStep, type ToolCallingModel } from '../../domain';
import { PromptContent } from '../../../ai/domain/interfaces/promptContent.interface';

export interface AgentRunRequest {
  model: ToolCallingModel;
  systemPrompt: string;
  content: PromptContent;
  label: string;
}

export interface ExecutedTool {
  output: string;
  step: AgentStep;
  contexts: CitedChunk[];
}

/** What the run has gathered so far. */
export interface RunProgress {
  steps: AgentStep[];
  sourcesRead: string[];
  contexts: CitedChunk[];
}
