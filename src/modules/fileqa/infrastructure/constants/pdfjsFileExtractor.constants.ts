import { ContentType } from '../../../../shared/http/enums/http.enums';
import { FileExtension } from '../enums/pdfjsFileExtractor.enums';

/** Only the first pages are sent: exam files are short and images are expensive tokens. */
export const MAX_PDF_PAGES = 20;

export const PDF_RENDER_SCALE = 2.0;

export const PAGE_TEXT_SEPARATOR = '\n\n';

export const IMAGE_MIME_TYPES: Readonly<Partial<Record<string, string>>> = {
  [FileExtension.JPG]: ContentType.JPEG,
  [FileExtension.JPEG]: ContentType.JPEG,
  [FileExtension.PNG]: ContentType.PNG,
  [FileExtension.GIF]: 'image/gif',
  [FileExtension.WEBP]: 'image/webp',
};
