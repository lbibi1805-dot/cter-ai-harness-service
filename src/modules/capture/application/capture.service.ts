import { randomBytes } from 'crypto';
import { ConflictError, NotFoundError, ValidationError } from '../../../shared/errors';
import { logger } from '../../../shared/logging/logger';
import { ObjectPrefix, type ObjectStorage } from '../../../shared/storage';
import {
  CaptureCatalog,
  batchPrefix,
  imageName,
  mimeTypeOfName,
  normalizeFolder,
  parseBatchIndex,
  type CaptureBatch,
  type CaptureImage,
} from '../domain';
import { CAPTURE_FILES_PATH, CAPTURE_IMAGE_ID_BYTES } from './constants/captureService.constants';
import { sniffCaptureImage } from './helpers/captureImageType.helper';
import type {
  CaptureBatchView,
  CaptureFile,
  CaptureFolderView,
  CaptureImageView,
  CaptureListQuery,
  CaptureListView,
  CaptureServiceOptions,
} from './interfaces/captureService.interface';

/**
 * Photo capture use cases: one person uploads photos of paper exercises into numbered batches per folder
 * ("bach/7"), many people read them back. Bytes live in object storage; the batch index lives in RAM
 * (CaptureCatalog), built from one listing on first use, so listing/polling costs no storage operation.
 * No database is involved (Neon must stay asleep).
 */
export class CaptureService {
  private readonly catalog = new CaptureCatalog();
  private loading: Promise<void> | null = null;

  constructor(
    private readonly storage: ObjectStorage,
    private readonly options: CaptureServiceOptions,
  ) {}

  get storageLocation(): string {
    return this.storage.location;
  }

  async createBatch(folderRaw: unknown): Promise<CaptureBatchView> {
    const folder = normalizeFolder(folderRaw);
    await this.ready();
    return this.toBatchView(this.catalog.createBatch(folder, this.options.now()));
  }

  /** Stores one photo in the batch (created when missing) and returns it. */
  async addImage(folderRaw: unknown, indexRaw: unknown, body: Buffer): Promise<CaptureImageView> {
    const folder = normalizeFolder(folderRaw);
    const index = parseBatchIndex(indexRaw);
    const mimeType = sniffCaptureImage(body);
    if (!mimeType) throw new ValidationError('body must be a JPEG, PNG, WebP or GIF image (HEIC: convert to JPEG first)');
    await this.ready();
    const existing = this.catalog.get(folder, index);
    if ((existing?.images.length ?? 0) >= this.options.maxImagesPerBatch) {
      throw new ConflictError(`batch ${folder}/${index} already has ${this.options.maxImagesPerBatch} images: start a new batch`);
    }
    const seq = this.catalog.reserveSeq(folder, index);
    const name = imageName(seq, randomBytes(CAPTURE_IMAGE_ID_BYTES).toString('hex'), mimeType);
    const key = `${batchPrefix(folder, index)}${name}`;
    await this.storage.put(key, body, { contentType: mimeType });
    const image: CaptureImage = { name, key, seq, mimeType, bytes: body.length, createdAt: this.options.now() };
    this.catalog.addImage(folder, index, image);
    return this.toImageView(folder, index, image);
  }

  async list(query: CaptureListQuery): Promise<CaptureListView> {
    const folder = query.folder === undefined ? undefined : normalizeFolder(query.folder);
    await this.ready();
    let batches = this.catalog.batches(folder);
    let hasMore = false;
    if (query.since !== undefined) {
      // Incremental sync: oldest change first, so `cursor` never skips a batch beyond `limit`.
      batches = batches.filter((b) => b.updatedAt > query.since!).sort((a, b) => a.updatedAt - b.updatedAt);
    } else {
      batches = batches.sort((a, b) => b.updatedAt - a.updatedAt);
    }
    if (batches.length > query.limit) {
      hasMore = true;
      batches = batches.slice(0, query.limit);
    }
    const views = await Promise.all(batches.map((b) => this.toBatchView(b)));
    const newest = Math.max(query.since ?? 0, ...batches.map((b) => b.updatedAt));
    return {
      folders: this.folderViews(),
      batches: views,
      cursor: newest > 0 ? new Date(newest).toISOString() : null,
      hasMore,
    };
  }

  async folders(): Promise<CaptureFolderView[]> {
    await this.ready();
    return this.folderViews();
  }

  async batch(folderRaw: unknown, indexRaw: unknown): Promise<CaptureBatchView> {
    return this.toBatchView(await this.requireBatch(folderRaw, indexRaw));
  }

  async readImage(folderRaw: unknown, indexRaw: unknown, name: string): Promise<CaptureFile> {
    const batch = await this.requireBatch(folderRaw, indexRaw);
    const image = batch.images.find((i) => i.name === name);
    if (!image || !mimeTypeOfName(name)) throw new NotFoundError(`image ${batch.folder}/${batch.index}/${name} not found`);
    const object = await this.storage.get(image.key);
    if (!object) throw new NotFoundError(`image ${batch.folder}/${batch.index}/${name} is gone from storage`);
    return { body: object.body, mimeType: image.mimeType };
  }

  /** Deletes the batch and its photos; returns how many photos were deleted. */
  async deleteBatch(folderRaw: unknown, indexRaw: unknown): Promise<number> {
    const batch = await this.requireBatch(folderRaw, indexRaw);
    const images = this.catalog.removeBatch(batch.folder, batch.index);
    if (images.length > 0) await this.storage.deleteMany(images.map((i) => i.key));
    return images.length;
  }

  /** Forces a rebuild from storage on next use (e.g. objects were changed outside the API). */
  invalidate(): void {
    this.loading = null;
  }

  private async requireBatch(folderRaw: unknown, indexRaw: unknown): Promise<CaptureBatch> {
    const folder = normalizeFolder(folderRaw);
    const index = parseBatchIndex(indexRaw);
    await this.ready();
    const batch = this.catalog.get(folder, index);
    if (!batch || batch.images.length === 0) throw new NotFoundError(`batch ${folder}/${index} not found`);
    return batch;
  }

  /** One listing of `captures/` the first time anything is asked; a failed load is retried next time. */
  private ready(): Promise<void> {
    if (!this.loading) {
      this.loading = this.storage.list(ObjectPrefix.CAPTURES).then((objects) => {
        const count = this.catalog.load(objects, this.options.now());
        logger.info(`[capture] indexed ${count} photos from ${this.storage.location}`);
      });
      this.loading.catch(() => { this.loading = null; });
    }
    return this.loading;
  }

  private folderViews(): CaptureFolderView[] {
    return this.catalog.summaries().map((s) => ({ ...s, updatedAt: new Date(s.updatedAt).toISOString() }));
  }

  private async toBatchView(batch: CaptureBatch): Promise<CaptureBatchView> {
    return {
      id: `${batch.folder}/${batch.index}`,
      folder: batch.folder,
      index: batch.index,
      createdAt: new Date(batch.createdAt).toISOString(),
      updatedAt: new Date(batch.updatedAt).toISOString(),
      imageCount: batch.images.length,
      images: await Promise.all(batch.images.map((image) => this.toImageView(batch.folder, batch.index, image))),
    };
  }

  private async toImageView(folder: string, index: number, image: CaptureImage): Promise<CaptureImageView> {
    let url: string | null = null;
    try {
      url = await this.storage.presignGet(image.key, this.options.urlTtlSeconds);
    } catch (err) {
      logger.warn(`[capture] presign failed for ${image.key}: ${(err as Error).message}`);
    }
    return {
      name: image.name,
      seq: image.seq,
      mimeType: image.mimeType,
      bytes: image.bytes,
      createdAt: new Date(image.createdAt).toISOString(),
      url,
      path: `${CAPTURE_FILES_PATH}${folder}/${index}/${image.name}`,
    };
  }
}
