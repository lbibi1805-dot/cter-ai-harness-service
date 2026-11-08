import { BYTES_PER_MB, DEFAULT_CHAT_LIMITS, DEFAULT_CHAT_MAX_BODY_MB, DEFAULT_GEMINI_INLINE_IMAGES_MAX_MB, DEFAULT_MAX_CHAT_IMAGES, type ChatLimits } from '../../../modules/chat';
import { ConfigurationError } from '../../../shared/errors';
import { readInt } from '../../../shared/config/env';

function positive(name: string, value: number): number {
  if (value <= 0) throw new ConfigurationError(`${name} must be a positive integer, got ${value}`);
  return value;
}

/** `/api/chat` request limits: CHAT_MAX_BODY_MB, MAX_CHAT_IMAGES, GEMINI_INLINE_IMAGES_MAX_MB, CHAT_UPLOAD_TTL_MS. */
export function readChatConfig(): ChatLimits {
  return {
    maxBodyBytes: positive('CHAT_MAX_BODY_MB', readInt('CHAT_MAX_BODY_MB', DEFAULT_CHAT_MAX_BODY_MB)) * BYTES_PER_MB,
    maxImages: positive('MAX_CHAT_IMAGES', readInt('MAX_CHAT_IMAGES', DEFAULT_MAX_CHAT_IMAGES)),
    geminiInlineImagesMaxBytes: positive('GEMINI_INLINE_IMAGES_MAX_MB', readInt('GEMINI_INLINE_IMAGES_MAX_MB', DEFAULT_GEMINI_INLINE_IMAGES_MAX_MB)) * BYTES_PER_MB,
    uploadTtlMs: positive('CHAT_UPLOAD_TTL_MS', readInt('CHAT_UPLOAD_TTL_MS', DEFAULT_CHAT_LIMITS.uploadTtlMs)),
  };
}
