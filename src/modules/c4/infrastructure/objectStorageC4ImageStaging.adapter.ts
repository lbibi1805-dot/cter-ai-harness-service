import type { ObjectStorage } from '../../../shared/storage';
import type { PromptImage } from '../../ai';
import { extensionForMime } from '../../conversation-store';
import type { C4ImageStaging, C4StagedImage } from '../application/interfaces/c4Sketch.interface';
import { C4_PENDING_IMAGE_PREFIX, DEFAULT_IMAGE_MIME } from './constants/c4ImageStaging.constants';

/** Images of paused C4 runs under `tmp/c4-pending/<sessionId>/` (R2 in prod, local disk in dev). */
export class ObjectStorageC4ImageStaging implements C4ImageStaging {
  constructor(private readonly storage: ObjectStorage) {}

  async stage(sessionId: string, images: PromptImage[]): Promise<C4StagedImage[]> {
    return Promise.all(images.map(async (image, i) => {
      const mime = image.mimeType || DEFAULT_IMAGE_MIME;
      const key = `${C4_PENDING_IMAGE_PREFIX}${sessionId}/${i}.${extensionForMime(mime)}`;
      await this.storage.put(key, image.data, { contentType: mime, metadata: { 'c4-session-id': sessionId } });
      return { key, mime };
    }));
  }

  async load(staged: C4StagedImage[]): Promise<PromptImage[] | null> {
    const objects = await Promise.all(staged.map((s) => this.storage.get(s.key)));
    if (objects.some((o) => !o)) return null;
    return objects.map((o, i) => ({ data: o!.body, mimeType: staged[i].mime }));
  }

  async discard(staged: C4StagedImage[]): Promise<void> {
    if (staged.length > 0) await this.storage.deleteMany(staged.map((s) => s.key));
  }
}
