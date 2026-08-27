import * as fs from 'fs';
import * as path from 'path';
import type { FileStatus, ProcessingRecord } from '../types';

export class StateManager {
  private records: Map<string, ProcessingRecord> = new Map();

  constructor(private filePath = 'data/processed.json') {}

  load(): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(this.filePath)) return;
    try {
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      const arr: ProcessingRecord[] = JSON.parse(raw);
      for (const r of arr) this.records.set(r.fileId, r);
    } catch {
      console.warn(`[StateManager] Could not parse ${this.filePath}, starting fresh.`);
    }
  }

  save(): void {
    const arr = Array.from(this.records.values());
    fs.writeFileSync(this.filePath, JSON.stringify(arr, null, 2), 'utf-8');
  }

  getStatus(fileId: string): FileStatus | undefined {
    return this.records.get(fileId)?.status;
  }

  setStatus(record: ProcessingRecord): void {
    this.records.set(record.fileId, { ...record, updatedAt: new Date().toISOString() });
    this.save();
  }

  isProcessed(fileId: string, currentFileName: string): boolean {
    const record = this.records.get(fileId);
    if (!record) return false;
    // File was renamed — treat as new, discard old state
    if (record.fileName !== currentFileName) {
      this.records.delete(fileId);
      this.save();
      return false;
    }
    return record.status === 'done' || record.status === 'failed' || record.status === 'processing';
  }

  /** Reset 'processing' records older than thresholdMs back to pending so they get retried. */
  resetStaleProcessing(thresholdMs: number): ProcessingRecord[] {
    const cutoff = Date.now() - thresholdMs;
    const stale: ProcessingRecord[] = [];
    for (const record of this.records.values()) {
      if (record.status === 'processing' && new Date(record.updatedAt).getTime() < cutoff) {
        record.status = 'pending';
        record.updatedAt = new Date().toISOString();
        stale.push(record);
      }
    }
    if (stale.length > 0) this.save();
    return stale;
  }

  incrementRetry(fileId: string): number {
    const r = this.records.get(fileId);
    if (!r) return 0;
    r.retryCount += 1;
    r.updatedAt = new Date().toISOString();
    this.save();
    return r.retryCount;
  }
}
