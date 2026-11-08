import { DEFAULT_CHAT_UPLOAD_TTL_MS } from '../../application/constants/stagedImages.constants';
import type { ChatLimits } from '../interfaces/chatLimits.interface';

export const BYTES_PER_MB = 1024 * 1024;

/** Base64 screenshots are ~1.4x the PNG size; 20 MB fits a few full-HD captures (CHAT_MAX_BODY_MB). */
export const DEFAULT_CHAT_MAX_BODY_MB = 20;

/** Images per question (MAX_CHAT_IMAGES). Providers allow far more; this protects latency (~258 tokens per Gemini tile). */
export const DEFAULT_MAX_CHAT_IMAGES = 10;

/**
 * Total decoded image bytes sent inline to Gemini (GEMINI_INLINE_IMAGES_MAX_MB). Gemini rejects inline requests
 * over 20 MB; the margin covers the prompt. Above it (current + hot-window + JIT images) the direct Gemini adapter
 * uploads the images to the Gemini Files API instead; 413 only when that upload fails.
 */
export const DEFAULT_GEMINI_INLINE_IMAGES_MAX_MB = 15;

export const DEFAULT_CHAT_LIMITS: Readonly<ChatLimits> = {
  maxBodyBytes: DEFAULT_CHAT_MAX_BODY_MB * BYTES_PER_MB,
  maxImages: DEFAULT_MAX_CHAT_IMAGES,
  geminiInlineImagesMaxBytes: DEFAULT_GEMINI_INLINE_IMAGES_MAX_MB * BYTES_PER_MB,
  uploadTtlMs: DEFAULT_CHAT_UPLOAD_TTL_MS,
};

/** Upper bound on the raw `history` array; the server keeps only the newest turns (see MAX_HISTORY_TURNS). */
export const MAX_RAW_HISTORY_TURNS = 200;

/** `refArtifactIds`: artifact aliases as shown in the conversation (`A7`, case-insensitive) or artifact UUIDs. */
export const MAX_REF_ARTIFACT_IDS = 10;

export const REF_ARTIFACT_ALIAS = /^a\d{1,6}$/i;

export const REF_ARTIFACT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const IMAGE_MIME_PREFIX = 'image/';

export const DATA_URL = /^data:([^;,]+);base64,([\s\S]*)$/;
