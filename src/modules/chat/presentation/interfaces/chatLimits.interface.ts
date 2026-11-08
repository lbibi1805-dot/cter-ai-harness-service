/** Request limits of `POST /api/chat` (env: CHAT_MAX_BODY_MB, MAX_CHAT_IMAGES, GEMINI_INLINE_IMAGES_MAX_MB). */
export interface ChatLimits {
  maxBodyBytes: number;
  maxImages: number;
  /** Total decoded image bytes sent inline to Gemini; above it the direct Gemini adapter uses the Files API. */
  geminiInlineImagesMaxBytes: number;
  /** CHAT_UPLOAD_TTL_MS: how long an image uploaded with `POST /api/chat/images` can be referenced by `imageIds`. */
  uploadTtlMs: number;
}
