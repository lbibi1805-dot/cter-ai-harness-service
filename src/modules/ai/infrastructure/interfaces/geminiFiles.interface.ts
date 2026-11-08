import type { GoogleGenAI } from '@google/genai';

/** The part of the `@google/genai` Files API the adapter uses (a test can hand in a fake). */
export type GeminiFilesClient = Pick<GoogleGenAI['files'], 'upload'>;

/** A Files API upload, reused across turns (keyed by the sha256 of the bytes). */
export interface GeminiFileRef {
  fileUri: string;
  mimeType: string;
}

export interface GeminiAdapterOptions {
  /** GEMINI_INLINE_IMAGES_MAX_MB in bytes: above it, the request's images go through the Files API. */
  inlineImagesMaxBytes?: number;
  files?: GeminiFilesClient;
  now?: () => number;
}
