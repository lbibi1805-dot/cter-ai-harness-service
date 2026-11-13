import { batchPrefix, parseCaptureKey } from './captureKey';
import type { CaptureBatch, CaptureFolderSummary, CaptureImage, CaptureObjectEntry } from './interfaces/capture.interface';

/**
 * In-memory index of every batch (aggregate root of the capture module). Rebuilt from ONE storage listing at
 * startup-on-demand; afterwards the service is the only writer, so reads never touch storage.
 * Sequence numbers are reserved synchronously, so parallel uploads into one batch never collide.
 */
export class CaptureCatalog {
  private readonly folders = new Map<string, Map<number, CaptureBatch>>();
  private readonly reservedSeq = new Map<string, number>();
  /** Highest index ever handed out per folder (not lowered by a delete, so "bài #7" never means two batches while running). */
  private readonly highWater = new Map<string, number>();

  /** Rebuilds the index from a listing of `captures/`; unknown keys are skipped. Returns how many images were indexed. */
  load(objects: readonly CaptureObjectEntry[], fallbackTime: number): number {
    this.folders.clear();
    this.reservedSeq.clear();
    this.highWater.clear();
    let count = 0;
    for (const object of objects) {
      const parts = parseCaptureKey(object.key);
      if (!parts) continue;
      const createdAt = object.lastModified?.getTime() ?? fallbackTime;
      this.addImage(parts.folder, parts.index, {
        name: parts.name, key: object.key, seq: parts.seq, mimeType: parts.mimeType, bytes: object.size, createdAt,
      });
      count++;
    }
    return count;
  }

  /** A new, empty batch numbered after the folder's highest index. */
  createBatch(folder: string, now: number): CaptureBatch {
    const batches = this.folderBatches(folder);
    const index = Math.max(this.highWater.get(folder) ?? 0, ...batches.keys()) + 1;
    const batch: CaptureBatch = { folder, index, createdAt: now, updatedAt: now, images: [] };
    batches.set(index, batch);
    this.bumpHighWater(folder, index);
    return batch;
  }

  /** The batch, created when missing (an upload to a batch lost by a restart still lands). */
  ensureBatch(folder: string, index: number, now: number): CaptureBatch {
    const batches = this.folderBatches(folder);
    let batch = batches.get(index);
    if (!batch) {
      batch = { folder, index, createdAt: now, updatedAt: now, images: [] };
      batches.set(index, batch);
      this.bumpHighWater(folder, index);
    }
    return batch;
  }

  get(folder: string, index: number): CaptureBatch | null {
    return this.folders.get(folder)?.get(index) ?? null;
  }

  /** Next sequence number of a batch, reserved now (before the async upload). */
  reserveSeq(folder: string, index: number): number {
    const batch = this.get(folder, index);
    const id = batchPrefix(folder, index);
    const used = Math.max(this.reservedSeq.get(id) ?? 0, ...(batch?.images.map((i) => i.seq) ?? []));
    this.reservedSeq.set(id, used + 1);
    return used + 1;
  }

  addImage(folder: string, index: number, image: CaptureImage): CaptureBatch {
    const batch = this.ensureBatch(folder, index, image.createdAt);
    batch.images = [...batch.images.filter((i) => i.name !== image.name), image].sort((a, b) => a.seq - b.seq);
    batch.createdAt = Math.min(batch.createdAt, image.createdAt);
    batch.updatedAt = Math.max(batch.updatedAt, image.createdAt);
    return batch;
  }

  /** Removes the batch; returns its images (for the storage delete). */
  removeBatch(folder: string, index: number): CaptureImage[] {
    const batches = this.folders.get(folder);
    const batch = batches?.get(index);
    if (!batches || !batch) return [];
    batches.delete(index);
    this.reservedSeq.delete(batchPrefix(folder, index));
    if (batches.size === 0) this.folders.delete(folder);
    return batch.images;
  }

  /** Every batch with at least one image (empty ones are still being filled). */
  batches(folder?: string): CaptureBatch[] {
    const sources = folder ? [this.folders.get(folder)] : [...this.folders.values()];
    return sources.flatMap((batches) => (batches ? [...batches.values()] : [])).filter((b) => b.images.length > 0);
  }

  summaries(): CaptureFolderSummary[] {
    return [...this.folders.keys()].sort().flatMap((name) => {
      const batches = this.batches(name);
      if (batches.length === 0) return [];
      return [{
        name,
        batchCount: batches.length,
        imageCount: batches.reduce((sum, b) => sum + b.images.length, 0),
        latestIndex: Math.max(...batches.map((b) => b.index)),
        updatedAt: Math.max(...batches.map((b) => b.updatedAt)),
      }];
    });
  }

  private folderBatches(folder: string): Map<number, CaptureBatch> {
    let batches = this.folders.get(folder);
    if (!batches) {
      batches = new Map();
      this.folders.set(folder, batches);
    }
    return batches;
  }

  private bumpHighWater(folder: string, index: number): void {
    this.highWater.set(folder, Math.max(this.highWater.get(folder) ?? 0, index));
  }
}
