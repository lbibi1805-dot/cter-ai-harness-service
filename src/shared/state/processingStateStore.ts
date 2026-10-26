import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../logging/logger';
import { attemptSync } from '../resilience/attempt';
import { DEFAULT_STATE_FILE, JSON_INDENT } from './constants/processingStateStore.constants';
import { ProcessingRecord } from './interfaces/processingRecord.interface';
import { ProcessingStatus } from './enums/processingRecord.enums';
import { HANDLED_STATUSES } from './constants/processingRecord.constants';

/**
 * Local JSON record of which Canvas items were processed, so a restart does
 * not answer the same file twice. Every change is written through to disk.
 */
export class StateManager {
  private records = new Map<string, ProcessingRecord>();

  constructor(private readonly filePath = DEFAULT_STATE_FILE) {}

  load(): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    if (!fs.existsSync(this.filePath)) return;
    const parsed = attemptSync(() => JSON.parse(fs.readFileSync(this.filePath, 'utf-8')) as ProcessingRecord[]);
    if (!parsed.ok) {
      logger.warn(`[state] Could not parse ${this.filePath}, starting fresh.`);
      return;
    }
    for (const record of parsed.value) this.records.set(record.fileId, record);
  }

  save(): void {
    fs.writeFileSync(this.filePath, JSON.stringify([...this.records.values()], null, JSON_INDENT), 'utf-8');
  }

  getStatus(fileId: string): ProcessingStatus | undefined {
    return this.records.get(fileId)?.status;
  }

  setStatus(record: ProcessingRecord): void {
    this.records.set(record.fileId, { ...record, updatedAt: new Date().toISOString() });
    this.save();
  }

  /** A renamed file is a new request: its old record is dropped. */
  isProcessed(fileId: string, currentFileName: string): boolean {
    const record = this.records.get(fileId);
    if (!record) return false;
    if (record.fileName !== currentFileName) {
      this.records.delete(fileId);
      this.save();
      return false;
    }
    return HANDLED_STATUSES.has(record.status);
  }

  /** Resets PROCESSING records older than `thresholdMs` back to PENDING so they are retried. */
  resetStaleProcessing(thresholdMs: number): ProcessingRecord[] {
    const cutoff = Date.now() - thresholdMs;
    const stale: ProcessingRecord[] = [];
    for (const record of this.records.values()) {
      if (record.status !== ProcessingStatus.PROCESSING || new Date(record.updatedAt).getTime() >= cutoff) continue;
      record.status = ProcessingStatus.PENDING;
      record.updatedAt = new Date().toISOString();
      stale.push(record);
    }
    if (stale.length > 0) this.save();
    return stale;
  }

  incrementRetry(fileId: string): number {
    const record = this.records.get(fileId);
    if (!record) return 0;
    record.retryCount += 1;
    record.updatedAt = new Date().toISOString();
    this.save();
    return record.retryCount;
  }
}
