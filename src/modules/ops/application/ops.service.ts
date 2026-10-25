import * as fs from 'fs';
import * as path from 'path';
import { NotFoundError, errorMessage } from '../../../shared/errors';
import { logger } from '../../../shared/logging/logger';
import { LogTag } from '../../../shared/logging/enums/logger.enums';
import { attempt } from '../../../shared/resilience/attempt';
import {
  AI_USAGE_RECENT_LINES,
  AI_USAGE_RECENT_SHOWN,
  AI_USAGE_SCAN_LINES,
  NO_VAULT_STATUS,
  OPENAPI_SPEC_PATH,
} from '../domain/constants/ops.constants';
import { LogEntry } from '../../../shared/logging/interfaces/logger.interface';
import { ServiceState } from '../domain/enums/ops.enums';
import { OpsStatusSource, MaskedAccount } from './interfaces/ops.interface';
import { maskedAccount } from './helpers/ops.helper';
import { AI_ACTIVITY_TAGS } from './constants/ops.constants';

/** Read-only views of the service state, plus log housekeeping. */
export class OpsService {
  constructor(private readonly source: OpsStatusSource) {}

  overview() {
    return {
      status: ServiceState.UP,
      polling: this.source.pollingState(),
      canvasAccounts: this.source.accounts.map(maskedAccount),
      aiKeys: this.source.aiCredentials(),
      vault: this.source.vectorIndex,
    };
  }

  async health() {
    return {
      status: ServiceState.UP,
      aiKeys: this.source.aiCredentials(),
      vault: await this.vaultStatus(),
      polling: this.source.pollingState(),
    };
  }

  aiUsage() {
    const recent = logger.getLogs(AI_USAGE_RECENT_LINES).filter((entry) => AI_ACTIVITY_TAGS.has(entry.tag));
    return {
      ...this.source.aiModels(),
      aiCalls: logger.getLogs(AI_USAGE_SCAN_LINES).filter((entry) => entry.tag === LogTag.AI).length,
      lastLogs: recent.slice(-AI_USAGE_RECENT_SHOWN),
    };
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

  openApiSpec(): string {
    const specPath = path.resolve(process.cwd(), OPENAPI_SPEC_PATH);
    if (!fs.existsSync(specPath)) throw new NotFoundError('spec not found');
    return fs.readFileSync(specPath, 'utf-8');
  }

  /** A database outage is reported in the body: `/health` itself must stay 200 for the host's probe. */
  private async vaultStatus(): Promise<string> {
    if (!this.source.vectorIndex) return NO_VAULT_STATUS;
    const stats = await attempt(() => this.source.vaultStats());
    return stats.ok ? `${stats.value.indexed}/${stats.value.total} indexed` : `error: ${errorMessage(stats.error)}`;
  }
}
