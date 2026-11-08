import { describe, it, expect, afterEach, vi } from 'vitest';
import { readChatConfig } from '../../../../src/bootstrap/config/readers/chatConfig.reader';
import { BYTES_PER_MB, DEFAULT_CHAT_LIMITS } from '../../../../src/modules/chat';

describe('readChatConfig (MAX_CHAT_IMAGES / CHAT_MAX_BODY_MB / GEMINI_INLINE_IMAGES_MAX_MB)', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('defaults to 10 images, a 20 MB body and 15 MB of inline Gemini images', () => {
    vi.stubEnv('MAX_CHAT_IMAGES', '');
    vi.stubEnv('CHAT_MAX_BODY_MB', '');
    vi.stubEnv('GEMINI_INLINE_IMAGES_MAX_MB', '');
    vi.stubEnv('CHAT_UPLOAD_TTL_MS', '');
    expect(readChatConfig()).toEqual(DEFAULT_CHAT_LIMITS);
    expect(DEFAULT_CHAT_LIMITS).toEqual({ maxImages: 10, maxBodyBytes: 20 * BYTES_PER_MB, geminiInlineImagesMaxBytes: 15 * BYTES_PER_MB, uploadTtlMs: 3_600_000 });
  });

  it('reads the env values', () => {
    vi.stubEnv('MAX_CHAT_IMAGES', '6');
    vi.stubEnv('CHAT_MAX_BODY_MB', '32');
    vi.stubEnv('GEMINI_INLINE_IMAGES_MAX_MB', '12');
    vi.stubEnv('CHAT_UPLOAD_TTL_MS', '60000');
    expect(readChatConfig()).toEqual({ maxImages: 6, maxBodyBytes: 32 * BYTES_PER_MB, geminiInlineImagesMaxBytes: 12 * BYTES_PER_MB, uploadTtlMs: 60_000 });
  });

  it('rejects non-positive or non-numeric values at startup', () => {
    vi.stubEnv('MAX_CHAT_IMAGES', '0');
    expect(() => readChatConfig()).toThrow(/MAX_CHAT_IMAGES/);
    vi.stubEnv('MAX_CHAT_IMAGES', 'many');
    expect(() => readChatConfig()).toThrow(/MAX_CHAT_IMAGES/);
  });
});
