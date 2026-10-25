import type { CanvasAccountConfig } from '../../../../shared/canvas/interfaces/canvasAccount.interface';

/** What the ops endpoints report about the rest of the service (wired in bootstrap). */
export interface OpsStatusSource {
  accounts: CanvasAccountConfig[];
  pollingState(): string;
  /** Per-provider credential presence under the active gateway. */
  aiCredentials(): Record<string, boolean>;
  /** Gateway, default models and fallback chains, for `/api/ai-usage`. */
  aiModels(): Record<string, unknown>;
  /** Null when the vector index is not configured. */
  vectorIndex: { index: string; provider: string } | null;
  vaultStats(): Promise<{ total: number; indexed: number }>;
}

export interface MaskedAccount {
  index: number;
  email: string | null;
}
