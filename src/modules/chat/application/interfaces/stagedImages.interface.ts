/** An image the client uploaded ahead of a chat/C4 request (RAM only — no database row). */
export interface StagedImage {
  imageId: string;
  objectKey: string;
  mimeType: string;
  bytes: number;
  width?: number;
  height?: number;
  createdAt: number;
}

/** One entry of the `POST /api/chat/images` answer. */
export interface StagedImageDto {
  imageId: string;
  mimeType: string;
  bytes: number;
  width?: number;
  height?: number;
}

/** What an upload carries before validation: bytes plus the declared type (checked against magic bytes). */
export interface RawUpload {
  data: Buffer;
  mimeType?: string;
}

/** Sniffed from the magic bytes and header (no decoding). */
export interface SniffedImage {
  mimeType: string;
  width?: number;
  height?: number;
}

export interface ResizedImage {
  data: Buffer;
  width: number;
  height: number;
}

/** Server-side downscale (port; `@napi-rs/canvas` in production). Null = could not decode: keep the original. */
export interface ImageResizer {
  resize(data: Buffer, mimeType: string, maxSide: number): Promise<ResizedImage | null>;
}

export interface StagedImagesOptions {
  /** CHAT_UPLOAD_TTL_MS. */
  ttlMs: number;
  maxEntries: number;
  now: () => number;
}
