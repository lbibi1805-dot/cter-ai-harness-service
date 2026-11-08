import { randomUUID } from 'crypto';
import { ValidationError, errorMessage } from '../../../shared/errors';
import { logger } from '../../../shared/logging/logger';
import { attempt } from '../../../shared/resilience/attempt';
import type { ObjectStorage } from '../../../shared/storage';
import type { PromptImage } from '../../ai';
import {
  STAGED_IMAGE_ID,
  STAGED_IMAGE_PREFIX,
  STAGED_OBJECT_METADATA_KEY,
  STAGED_RESIZE_TARGET_PX,
  STAGED_RESIZE_THRESHOLD_PX,
  STAGED_SWEEP_MIN_INTERVAL_MS,
} from './constants/stagedImages.constants';
import { parseImageIds } from './helpers/imageIds.helper';
import { sniffImage } from './helpers/imageSniff.helper';
import type { ImageResizer, RawUpload, StagedImage, StagedImageDto, StagedImagesOptions } from './interfaces/stagedImages.interface';

const RESIZABLE = new Set(['image/png', 'image/jpeg']);

/**
 * Upload-first images (`POST /api/chat/images`): the client sends the bytes once, then refers to them by
 * `imageIds` in /api/chat and /api/c4. Bytes live in object storage under `tmp/uploads/`, metadata in RAM
 * only (no database query). Consumed uploads are deleted after the request; unconsumed ones are swept after
 * CHAT_UPLOAD_TTL_MS — opportunistically, on upload requests only (an idle server never touches storage),
 * and the bucket's `tmp/` lifecycle rule removes whatever a restart left behind.
 */
export class StagedImageService {
  private readonly entries = new Map<string, StagedImage>();
  private lastSweepAt = 0;
  private sweeping = false;

  constructor(
    private readonly storage: ObjectStorage,
    private readonly resizer: ImageResizer | null,
    private readonly options: StagedImagesOptions,
  ) {}

  /** Validates (magic bytes), downscales very large PNG/JPEG, stores; all uploads in parallel. */
  async stage(uploads: RawUpload[]): Promise<StagedImageDto[]> {
    const checked = uploads.map((upload, i) => {
      const sniffed = sniffImage(upload.data);
      if (!sniffed) throw new ValidationError(`images[${i}] is not a PNG, JPEG, GIF or WebP image`);
      return { upload, sniffed };
    });
    this.maybeSweep();
    return Promise.all(checked.map(async ({ upload, sniffed }) => {
      let data = upload.data;
      let { width, height } = sniffed;
      if (this.resizer && RESIZABLE.has(sniffed.mimeType) && Math.max(width ?? 0, height ?? 0) > STAGED_RESIZE_THRESHOLD_PX) {
        const resized = await this.resizer.resize(data, sniffed.mimeType, STAGED_RESIZE_TARGET_PX);
        if (resized) ({ data, width, height } = resized);
      }
      const imageId = randomUUID();
      const objectKey = `${STAGED_IMAGE_PREFIX}${imageId}`;
      await this.storage.put(objectKey, data, { contentType: sniffed.mimeType, metadata: { [STAGED_OBJECT_METADATA_KEY]: '1' } });
      const entry: StagedImage = {
        imageId, objectKey, mimeType: sniffed.mimeType, bytes: data.length, createdAt: this.options.now(),
        ...(width ? { width } : {}), ...(height ? { height } : {}),
      };
      this.remember(entry);
      return { imageId, mimeType: entry.mimeType, bytes: entry.bytes, ...(width ? { width } : {}), ...(height ? { height } : {}) };
    }));
  }

  /** Bytes of uploaded images, in the given order (fetched in parallel). Unknown or expired id → 400. */
  async resolve(requested: string[]): Promise<PromptImage[]> {
    const imageIds = requested.map((id) => id.trim().toLowerCase());
    const now = this.options.now();
    for (const [i, id] of imageIds.entries()) {
      if (!STAGED_IMAGE_ID.test(id)) throw new ValidationError(`imageIds[${i}] must be an imageId returned by POST /api/chat/images`);
      const entry = this.entries.get(id);
      if (entry && now - entry.createdAt > this.options.ttlMs) throw new ValidationError(`imageIds[${i}] has expired: upload the image again`);
    }
    return Promise.all(imageIds.map(async (id, i) => {
      const entry = this.entries.get(id);
      const object = await this.storage.get(entry?.objectKey ?? `${STAGED_IMAGE_PREFIX}${id.toLowerCase()}`);
      // Not in RAM (e.g. after a restart) but still in storage: the magic bytes give the type back.
      const mimeType = entry?.mimeType ?? (object ? sniffImage(object.body)?.mimeType : undefined);
      if (!object || !mimeType) throw new ValidationError(`imageIds[${i}] is unknown or expired: upload the image again`);
      return { data: object.body, mimeType };
    }));
  }

  /** After a request used the uploads (the turn stored its own copy): forget them and delete the objects. */
  consume(imageIds: string[]): void {
    const keys = imageIds.filter((id) => STAGED_IMAGE_ID.test(id)).map((id) => {
      const key = this.entries.get(id)?.objectKey ?? `${STAGED_IMAGE_PREFIX}${id.toLowerCase()}`;
      this.entries.delete(id);
      return key;
    });
    if (keys.length > 0) this.deleteQuietly(keys);
  }

  /**
   * For flows that parse base64 `images` themselves (/api/c4): resolves `imageIds` and appends them to
   * `images` as base64 entries. Returns the body unchanged when it has no ids.
   */
  async expandBody(body: unknown, maxImages: number): Promise<{ body: unknown; imageIds: string[] }> {
    const imageIds = parseImageIds(body && typeof body === 'object' ? (body as Record<string, unknown>).imageIds : undefined, maxImages);
    if (imageIds.length === 0) return { body, imageIds };
    const raw = body as Record<string, unknown>;
    const inline = Array.isArray(raw.images) ? raw.images : [];
    const staged = (await this.resolve(imageIds)).map((image) => ({ mimeType: image.mimeType, data: image.data.toString('base64') }));
    return { body: { ...raw, images: [...inline, ...staged] }, imageIds };
  }

  /** Tracked uploads (tests, ops). */
  get size(): number {
    return this.entries.size;
  }

  /** Runs the sweep now (tests); production calls it only from `stage`. */
  async sweep(): Promise<number> {
    const now = this.options.now();
    const expired = [...this.entries.values()].filter((e) => now - e.createdAt > this.options.ttlMs);
    for (const e of expired) this.entries.delete(e.imageId);
    if (expired.length > 0) {
      const deleted = await attempt(() => this.storage.deleteMany(expired.map((e) => e.objectKey)));
      if (!deleted.ok) logger.warn(`[chat-images] sweep could not delete ${expired.length} uploads: ${errorMessage(deleted.error)}`);
    }
    return expired.length;
  }

  private maybeSweep(): void {
    const now = this.options.now();
    if (this.sweeping || now - this.lastSweepAt < STAGED_SWEEP_MIN_INTERVAL_MS) return;
    this.lastSweepAt = now;
    this.sweeping = true;
    void this.sweep().finally(() => { this.sweeping = false; });
  }

  private remember(entry: StagedImage): void {
    this.entries.set(entry.imageId, entry);
    const evicted: string[] = [];
    while (this.entries.size > this.options.maxEntries) {
      const oldest = this.entries.values().next().value as StagedImage;
      this.entries.delete(oldest.imageId);
      evicted.push(oldest.objectKey);
    }
    if (evicted.length > 0) this.deleteQuietly(evicted);
  }

  private deleteQuietly(keys: string[]): void {
    void attempt(() => this.storage.deleteMany(keys)).then((r) => {
      if (!r.ok) logger.warn(`[chat-images] could not delete ${keys.length} staged uploads: ${errorMessage(r.error)}`);
    });
  }
}
