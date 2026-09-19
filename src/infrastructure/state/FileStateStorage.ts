import { StateManager } from '../../state/stateManager';
import type { IStatePort } from '../../domain/ports/IStatePort';

export class FileStateStorage implements IStatePort {
  constructor(private manager: StateManager) {}
  load(): void { this.manager.load(); }
  save(): void { this.manager.save(); }
  getStatus(fileId: string) { return this.manager.getStatus(fileId); }
  setStatus(record: import('../../types').ProcessingRecord): void { this.manager.setStatus(record); }
  isProcessed(fileId: string, currentFileName: string): boolean { return this.manager.isProcessed(fileId, currentFileName); }
  resetStaleProcessing(thresholdMs: number) { return this.manager.resetStaleProcessing(thresholdMs); }
  incrementRetry(fileId: string) { return this.manager.incrementRetry(fileId); }
}
