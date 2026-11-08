import { DomainError, ErrorCode } from '../../../../shared/errors';
import { BYTES_PER_MB } from '../constants/chat.constants';

const MB_DECIMALS = 1;

/** HTTP 413: the images are too big to send inline to the provider (no Files API upload yet). */
export class ImagesTooLargeError extends DomainError {
  readonly code = ErrorCode.PAYLOAD_TOO_LARGE;

  constructor(totalBytes: number, limitBytes: number, provider: string) {
    super(
      `Images total ${(totalBytes / BYTES_PER_MB).toFixed(MB_DECIMALS)} MB, over the ${(limitBytes / BYTES_PER_MB).toFixed(MB_DECIMALS)} MB `
      + `inline limit for ${provider}. Compress the images (JPEG quality ~85, long edge ≤ 1568 px) or send fewer, then retry.`,
    );
  }
}
