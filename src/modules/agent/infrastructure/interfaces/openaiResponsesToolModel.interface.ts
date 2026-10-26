import { type Sleep } from '../../../../shared/resilience';

export interface ToolModelTimeouts {
  timeoutMs: number;
  sleep?: Sleep;
}
