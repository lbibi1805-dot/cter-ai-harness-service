import { createHash } from 'crypto';
import { GEMINI_FILE_CACHE_MAX_ENTRIES, GEMINI_FILE_CACHE_TTL_MS } from '../constants/gemini.constants';
import type { GeminiFileRef } from '../interfaces/geminiFiles.interface';

export function sha256Of(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * RAM cache of Gemini Files API uploads keyed by the sha256 of the bytes: a hot-window image is uploaded
 * once and the same `fileUri` is sent on every later turn (stable prefix → implicit cache hits). TTL 47 h.
 */
export class GeminiFileCache {
  private readonly entries = new Map<string, { ref: GeminiFileRef; expiresAt: number }>();

  constructor(private readonly now: () => number = Date.now) {}

  get size(): number {
    return this.entries.size;
  }

  get(sha: string): GeminiFileRef | null {
    const entry = this.entries.get(sha);
    if (!entry) return null;
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(sha);
      return null;
    }
    return entry.ref;
  }

  set(sha: string, ref: GeminiFileRef): void {
    this.entries.delete(sha);
    this.entries.set(sha, { ref, expiresAt: this.now() + GEMINI_FILE_CACHE_TTL_MS });
    while (this.entries.size > GEMINI_FILE_CACHE_MAX_ENTRIES) this.entries.delete(this.entries.keys().next().value as string);
  }
}
