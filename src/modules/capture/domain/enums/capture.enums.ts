/** Image types the capture API stores (what every AI provider accepts). Value = MIME type. */
export enum CaptureMimeType {
  JPEG = 'image/jpeg',
  PNG = 'image/png',
  WEBP = 'image/webp',
  GIF = 'image/gif',
}

/** File extension per stored type (keys only use these). */
export const CAPTURE_EXTENSION: Readonly<Record<CaptureMimeType, string>> = {
  [CaptureMimeType.JPEG]: 'jpg',
  [CaptureMimeType.PNG]: 'png',
  [CaptureMimeType.WEBP]: 'webp',
  [CaptureMimeType.GIF]: 'gif',
};
