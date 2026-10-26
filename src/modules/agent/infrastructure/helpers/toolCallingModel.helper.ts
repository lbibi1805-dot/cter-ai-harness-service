import { AgentFallbackReason, type ToolModelResolution } from '../../domain';

export function unsupported(reason: AgentFallbackReason): ToolModelResolution {
  return { supported: false, reason };
}
