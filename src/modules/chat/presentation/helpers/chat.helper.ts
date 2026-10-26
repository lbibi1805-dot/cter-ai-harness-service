import { ValidationError } from '../../../../shared/errors';
import { type PromptImage } from '../../../ai';
import { DATA_URL, IMAGE_MIME_PREFIX, MAX_CHAT_IMAGES } from '../constants/chat.constants';
import { RawImage } from '../dto/chat.dto';

export function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function parseImages(rawImages: unknown): PromptImage[] {
  const list = rawImages ?? [];
  if (!Array.isArray(list)) throw new ValidationError('images must be an array');
  if (list.length > MAX_CHAT_IMAGES) throw new ValidationError(`At most ${MAX_CHAT_IMAGES} images per question`);
  return (list as RawImage[]).map((image, i) => {
    const decoded = decodeImage(image);
    if (!decoded) throw new ValidationError(`images[${i}] must be { mimeType: "image/*", data: <base64 or data URL> }`);
    return decoded;
  });
}

export function decodeImage(image: RawImage): PromptImage | null {
  if (!image || typeof image !== 'object' || typeof image.data !== 'string') return null;
  let mimeType = typeof image.mimeType === 'string' ? image.mimeType : '';
  let base64 = image.data;
  const dataUrl = DATA_URL.exec(base64);
  if (dataUrl) {
    mimeType ||= dataUrl[1];
    base64 = dataUrl[2];
  }
  if (!mimeType.startsWith(IMAGE_MIME_PREFIX)) return null;
  const data = Buffer.from(base64, 'base64');
  return data.length > 0 ? { data, mimeType } : null;
}
