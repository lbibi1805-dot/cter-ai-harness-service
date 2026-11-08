import { ValidationError } from '../../../../shared/errors';
import { STAGED_IMAGE_ID } from '../constants/stagedImages.constants';

/** `imageIds`: ids from `POST /api/chat/images`; deduped, order kept, at most `maxImages`. */
export function parseImageIds(raw: unknown, maxImages: number): string[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw new ValidationError('imageIds must be an array of ids returned by POST /api/chat/images');
  const ids = raw.map((value, i) => {
    const id = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (!STAGED_IMAGE_ID.test(id)) throw new ValidationError(`imageIds[${i}] must be an imageId returned by POST /api/chat/images`);
    return id;
  });
  const unique = [...new Set(ids)];
  if (unique.length > maxImages) throw new ValidationError(`At most ${maxImages} images per question (got ${unique.length} imageIds)`);
  return unique;
}
