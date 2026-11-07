import { errorMessage } from '../../errors';
import { ObjectPrefix } from '../enums/objectStorage.enums';
import type { ObjectStorage } from '../objectStorage.port';

export interface ObjectStorageProbe {
  ok: boolean;
  kind: string;
  /** Bucket name (R2) or directory (local disk). */
  location: string;
  /** Round trip of the whole probe (put + head + delete). */
  latencyMs: number;
  /** The step that failed, when `ok` is false. */
  failedStep?: 'put' | 'head' | 'delete';
  error?: string;
}

/**
 * Writes, reads back and deletes one tiny object under `tmp/` (the bucket's 1-day
 * lifecycle rule removes it even if the delete fails). Proves the credentials can
 * read and write, not just that the endpoint answers. On-demand only: never call
 * it from a timer (2 Class A + 1 Class B R2 operations per call).
 */
export async function probeObjectStorage(storage: ObjectStorage, now: () => number = Date.now): Promise<ObjectStorageProbe> {
  const started = now();
  const key = `${ObjectPrefix.TMP}healthcheck/${started}-${Math.random().toString(36).slice(2, 8)}.txt`;
  const base = { kind: storage.kind, location: storage.location };
  let step: ObjectStorageProbe['failedStep'] = 'put';
  try {
    await storage.put(key, 'ok', { contentType: 'text/plain' });
    step = 'head';
    const info = await storage.head(key);
    if (!info) throw new Error('object not found right after put');
    step = 'delete';
    await storage.delete(key);
    return { ok: true, ...base, latencyMs: now() - started };
  } catch (error) {
    return { ok: false, ...base, latencyMs: now() - started, failedStep: step, error: errorMessage(error) };
  }
}
