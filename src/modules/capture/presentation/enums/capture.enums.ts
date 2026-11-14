export enum CaptureApiPath {
  LIST = '/api/captures',
  FOLDERS = '/api/captures/folders',
  BATCHES = '/api/captures/batches',
  BATCH_PREFIX = '/api/captures/batches/',
  IMAGES_SUFFIX = '/images',
  /** Third segment of `DELETE /api/captures/batches/{folder}/{index}/images/{name}`. */
  IMAGES_SEGMENT = 'images',
  FILES_PREFIX = '/api/captures/files/',
}

/** Where the per-image delete token (returned by the upload) may be sent. */
export enum CaptureDeleteTokenSource {
  HEADER = 'x-delete-token',
  QUERY = 'token',
}

/** Where the shared key may be sent (header for apps, query for `<img src>`). */
export enum CaptureKeySource {
  HEADER = 'x-capture-key',
  QUERY = 'key',
}
