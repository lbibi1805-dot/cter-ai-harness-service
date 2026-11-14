import { type Sleep } from '../../../../shared/resilience';

export interface ToolModelTimeouts {
  timeoutMs: number;
  sleep?: Sleep;
  /** AI_MAX_OUTPUT_TOKENS sent as `max_output_tokens` (08 Bước 2); absent = the model's default. */
  maxOutputTokens?: number;
}
