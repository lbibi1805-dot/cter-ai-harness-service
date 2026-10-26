import { HttpStatus } from '../../../../shared/http/enums/http.enums';

/** Canvas answers the final upload step with a redirect to the created file; that is success. */
export const UPLOAD_REDIRECT_STATUSES: ReadonlySet<number> = new Set([HttpStatus.MOVED_PERMANENTLY, HttpStatus.FOUND]);

export const MULTIPART_FILE_FIELD = 'file';
