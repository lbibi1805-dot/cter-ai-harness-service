import { createHash } from 'crypto';
import type { DiagramRender } from '../../domain';

/** sha256 of the normalized source: the cache key of a rendered preview. */
export function renderCacheKey(normalizedSource: string): string {
  return createHash('sha256').update(normalizedSource, 'utf-8').digest('hex');
}

/**
 * In-memory LRU of render results (PNG or syntax error), bounded by entry count and PNG bytes.
 * Map iteration order is insertion order: a hit is re-inserted, the first key is the least recent.
 */
export class RenderCache {
  private readonly entries = new Map<string, DiagramRender>();
  private bytes = 0;

  constructor(private readonly maxEntries: number, private readonly maxBytes: number) {}

  get size(): number {
    return this.entries.size;
  }

  get(key: string): DiagramRender | undefined {
    const hit = this.entries.get(key);
    if (!hit) return undefined;
    this.entries.delete(key);
    this.entries.set(key, hit);
    return hit;
  }

  set(key: string, value: DiagramRender): void {
    const size = value.png?.length ?? 0;
    if (size > this.maxBytes) return;
    this.delete(key);
    this.entries.set(key, value);
    this.bytes += size;
    while (this.entries.size > this.maxEntries || this.bytes > this.maxBytes) {
      const oldest = this.entries.keys().next().value as string;
      this.delete(oldest);
    }
  }

  private delete(key: string): void {
    const old = this.entries.get(key);
    if (!old) return;
    this.bytes -= old.png?.length ?? 0;
    this.entries.delete(key);
  }
}
