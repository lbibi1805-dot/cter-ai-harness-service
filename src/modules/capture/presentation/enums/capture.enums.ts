export enum CaptureApiPath {
  LIST = '/api/captures',
  FOLDERS = '/api/captures/folders',
  BATCHES = '/api/captures/batches',
  BATCH_PREFIX = '/api/captures/batches/',
  IMAGES_SUFFIX = '/images',
  FILES_PREFIX = '/api/captures/files/',
}

/** Where the shared key may be sent (header for apps, query for `<img src>`). */
export enum CaptureKeySource {
  HEADER = 'x-capture-key',
  QUERY = 'key',
}

/** Which keys a route accepts. */
export enum CaptureAccess {
  /** CAPTURE_API_KEY, CAPTURE_UPLOAD_KEY or ADMIN_TOKEN. */
  READ = 'read',
  /** CAPTURE_UPLOAD_KEY (defaults to CAPTURE_API_KEY) or ADMIN_TOKEN. */
  UPLOAD = 'upload',
}
