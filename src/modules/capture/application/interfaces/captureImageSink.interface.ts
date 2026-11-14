import type { CaptureMimeType } from '../../domain';

/** One photo the capture API has just stored (metadata only: the bytes stay in object storage). */
export interface CaptureStoredImage {
  folder: string;
  index: number;
  seq: number;
  /** Name inside the batch, e.g. `03-a1b2c3.jpg`. */
  name: string;
  mimeType: CaptureMimeType;
  bytes: number;
}

/**
 * Port: who else wants to know about new photos (planning-15112026-starlinguide-push).
 * Only uploads reach it: photos loaded back from storage at startup never do, so photos
 * already in the bucket are never forwarded. Implementations must not throw or block.
 */
export interface CaptureImageSink {
  imageStored(image: CaptureStoredImage): void;
  imageDeleted(folder: string, index: number, name: string): void;
}

/** Default sink: nobody listens. */
export const NO_CAPTURE_SINK: CaptureImageSink = {
  imageStored: () => undefined,
  imageDeleted: () => undefined,
};
