import { type ToolCallingModelFactory } from '../../domain';
import type { AgentRunner } from '../agentRunner.service';

export interface AgentCapability {
  runner: AgentRunner;
  createModel: ToolCallingModelFactory;
  systemPrompt: string;
}
