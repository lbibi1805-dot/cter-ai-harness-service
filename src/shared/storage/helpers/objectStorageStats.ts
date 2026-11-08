import { STORAGE_STATS_PREFIXES } from '../constants/objectStorageStats.constants';
import type { ObjectStorageStats, PrefixUsage } from '../interfaces/objectStorageStats.interface';
import type { ObjectStorage } from '../objectStorage.port';

/**
 * Lists every object under each prefix and sums sizes. On R2 each page of
 * 1000 keys is one Class A operation: on demand only, never from a timer.
 */
export async function objectStorageStats(
  storage: ObjectStorage,
  prefixes: readonly string[] = STORAGE_STATS_PREFIXES,
  now: () => number = Date.now,
): Promise<ObjectStorageStats> {
  const started = now();
  const usage: Record<string, PrefixUsage> = {};
  for (const prefix of prefixes) {
    const objects = await storage.list(prefix);
    usage[prefix] = { objects: objects.length, bytes: objects.reduce((sum, o) => sum + (o.size ?? 0), 0) };
  }
  const values = Object.values(usage);
  return {
    kind: storage.kind,
    location: storage.location,
    prefixes: usage,
    totalObjects: values.reduce((sum, u) => sum + u.objects, 0),
    totalBytes: values.reduce((sum, u) => sum + u.bytes, 0),
    latencyMs: now() - started,
  };
}
