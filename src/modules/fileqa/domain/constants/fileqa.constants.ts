/** Canvas I/O gets a few quick retries; AI calls have their own retry policy. */
export const IO_ATTEMPTS = 3;
/** PDF rendering (Chromium) is retried once: a crashed browser is relaunched on the next try. */
export const RENDER_ATTEMPTS = 2;

/** Only files named `START_…` are requests; Canvas pre-filters the listing with this term. */
export const START_FILE_PREFIX = 'START_';
/** `START_x_gemini.docx` is answered as `START_x_gemini_DONE.pdf`. */
export const DONE_FILE_SUFFIX = '_DONE.pdf';
/** Canvas `on_duplicate` policy for result uploads. */
export const UPLOAD_ON_DUPLICATE = 'overwrite';

export const DEFAULT_CANVAS_FOLDERS = { materials: 'Materials2', input: 'Q', output: 'A' } as const;
