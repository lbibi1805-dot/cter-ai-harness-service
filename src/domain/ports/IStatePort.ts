import type { FileStatus, ProcessingRecord } from '../../types';

export interface IStatePort {
  load(): void;
  save(): void;
  getStatus(fileId: string): FileStatus | undefined;
  setStatus(record: ProcessingRecord): void;
  isProcessed(fileId: string, currentFileName: string): boolean;
  resetStaleProcessing(thresholdMs: number): ProcessingRecord[];
  incrementRetry(fileId: string): number;
}
