import * as fs from 'fs';
import * as path from 'path';
import { NotFoundError, errorMessage } from '../../../shared/errors';
import { logger } from '../../../shared/logging/logger';
import { LogTag } from '../../../shared/logging/enums/logger.enums';
import { attempt, attemptSync } from '../../../shared/resilience/attempt';
import {
  AI_USAGE_RECENT_LINES,
  AI_USAGE_RECENT_SHOWN,
  AI_USAGE_SCAN_LINES,
  NO_VAULT_STATUS,
  OPENAPI_SPEC_PATH,
  VAULT_LOADING_STATUS,
} from '../domain/constants/ops.constants';
import { LogEntry } from '../../../shared/logging/interfaces/logger.interface';
import { DeepCheckName, DeepCheckStatus, ServiceState } from '../domain/enums/ops.enums';
import { OpsStatusSource, MaskedAccount, DeepCheckResult, DeepHealthReport, DeepProbe } from './interfaces/ops.interface';
import { maskedAccount } from './helpers/ops.helper';
import { AI_ACTIVITY_TAGS } from './constants/ops.constants';
import { OPS_OPENAPI_PATHS } from './constants/opsOpenApi.constants';
import { C4_OPENAPI_PATHS } from '../../c4/presentation/constants/c4OpenApi.constants';
import { CHAT_OPENAPI_PATHS } from '../../chat/presentation/constants/chatOpenApi.constants';

/** Read-only views of the service state, plus log housekeeping. */
export class OpsService {
  constructor(
    private readonly source: OpsStatusSource,
    private readonly now: () => number = Date.now,
  ) {}

  overview() {
    return {
      status: ServiceState.UP,
      polling: this.source.pollingState(),
      canvasAccounts: this.source.accounts.map(maskedAccount),
      aiKeys: this.source.aiCredentials(),
      vault: this.source.vectorIndex,
    };
  }

  /** Polled by the UI every few seconds: RAM only, never a database query. */
  async health() {
    return {
      status: ServiceState.UP,
      aiKeys: this.source.aiCredentials(),
      vault: await this.vaultStatus(),
      polling: this.source.pollingState(),
    };
  }

  /** Real round-trips to every configured dependency, each timed. Costs money: on demand only. */
  async deepHealth(): Promise<DeepHealthReport> {
    const probes = this.source.deepProbes ?? {};
    const names = Object.values(DeepCheckName);
    const results = await Promise.all(names.map((name) => this.runProbe(probes[name])));
    const checks = Object.fromEntries(names.map((name, i) => [name, results[i]])) as Record<DeepCheckName, DeepCheckResult>;
    return {
      ok: results.every((r) => r.status !== DeepCheckStatus.FAILED),
      checkedAt: new Date(this.now()).toISOString(),
      checks,
    };
  }

  aiUsage() {
    const recent = logger.getLogs(AI_USAGE_RECENT_LINES).filter((entry) => AI_ACTIVITY_TAGS.has(entry.tag));
    return {
      ...this.source.aiModels(),
      aiCalls: logger.getLogs(AI_USAGE_SCAN_LINES).filter((entry) => entry.tag === LogTag.AI).length,
      lastLogs: recent.slice(-AI_USAGE_RECENT_SHOWN),
      ...(this.source.circuit ? { circuit: this.source.circuit() } : {}),
    };
  }

  /** RAM counters only. Null when no database metrics are wired. */
  dbMetrics(): Record<string, unknown> | null {
    return this.source.dbMetrics?.() ?? null;
  }

  /** True when a latency provider is wired. */
  hasLatency(): boolean {
    return typeof this.source.latency === 'function';
  }

  latency(windowMs: number): unknown {
    return this.source.latency?.(windowMs);
  }

  /** Null when no prompt registry is wired (system-prompt.md fallback). */
  prompts(): unknown {
    return this.source.prompts?.() ?? null;
  }

  evals(): unknown {
    return this.source.evals?.() ?? [];
  }

  publicConfig(): Record<string, unknown> {
    return this.source.publicConfig?.() ?? {};
  }

  /** Null when the service has no object storage wired. */
  async storageStats() {
    return this.source.storageStats ? this.source.storageStats() : null;
  }

  /** Null when the service has no object storage wired. */
  async storageCheck() {
    return this.source.probeStorage ? this.source.probeStorage() : null;
  }

  canvasAccounts(): Array<MaskedAccount & { url: string }> {
    return this.source.accounts.map((account) => ({ ...maskedAccount(account), url: account.url }));
  }

  recentLogs(limit: number): LogEntry[] {
    return logger.getLogs(limit);
  }

  clearLogs(): void {
    logger.clear();
  }

  /** The spec file, plus the ops/C4/chat paths it does not describe yet. */
  openApiSpec(): string {
    const specPath = path.resolve(process.cwd(), OPENAPI_SPEC_PATH);
    if (!fs.existsSync(specPath)) throw new NotFoundError('spec not found');
    const raw = fs.readFileSync(specPath, 'utf-8');
    const parsed = attemptSync(() => JSON.parse(raw) as { paths?: Record<string, unknown> });
    if (!parsed.ok) return raw;
    const spec = parsed.value;
    spec.paths = { ...OPS_OPENAPI_PATHS, ...C4_OPENAPI_PATHS, ...CHAT_OPENAPI_PATHS, ...(spec.paths ?? {}) };
    return JSON.stringify(spec, null, 2);
  }

  /** A database outage is reported in the body: `/health` itself must stay 200 for the host's probe. */
  private async vaultStatus(): Promise<string> {
    if (!this.source.vectorIndex) return NO_VAULT_STATUS;
    const stats = await attempt(() => this.source.vaultStats());
    if (!stats.ok) return `error: ${errorMessage(stats.error)}`;
    return stats.value ? `${stats.value.indexed}/${stats.value.total} indexed` : VAULT_LOADING_STATUS;
  }

  private async runProbe(probe: DeepProbe | undefined): Promise<DeepCheckResult> {
    if (!probe) return { status: DeepCheckStatus.SKIPPED };
    const started = this.now();
    const run = await attempt(probe);
    const latencyMs = this.now() - started;
    if (!run.ok) return { status: DeepCheckStatus.FAILED, latencyMs, error: errorMessage(run.error) };
    return { ...(run.value ?? {}), status: DeepCheckStatus.OK, latencyMs };
  }
}
