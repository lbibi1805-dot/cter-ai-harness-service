import { createCanvas, loadImage } from '@napi-rs/canvas';
import { STAGED_RESIZE_JPEG_QUALITY } from '../application/constants/stagedImages.constants';
import type { ImageResizer, ResizedImage } from '../application/interfaces/stagedImages.interface';

/** Downscale with `@napi-rs/canvas` (already a dependency for PDF rendering). PNG stays PNG, JPEG stays JPEG. */
export class CanvasImageResizer implements ImageResizer {
  async resize(data: Buffer, mimeType: string, maxSide: number): Promise<ResizedImage | null> {
    try {
      const image = await loadImage(data);
      const longest = Math.max(image.width, image.height);
      if (!longest || longest <= maxSide) return null;
      const scale = maxSide / longest;
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      const canvas = createCanvas(width, height);
      canvas.getContext('2d').drawImage(image, 0, 0, width, height);
      const out = mimeType === 'image/png' ? await canvas.encode('png') : await canvas.encode('jpeg', STAGED_RESIZE_JPEG_QUALITY);
      return { data: out, width, height };
    } catch {
      return null;
    }
  }
}
