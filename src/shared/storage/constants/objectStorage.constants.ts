export const MAX_OBJECT_KEY_LENGTH = 1024;

/** S3/R2 DeleteObjects accepts at most 1000 keys per call. */
export const DELETE_BATCH_SIZE = 1000;

export const DEFAULT_LOCAL_OBJECT_DIR = './data/object-store';

/** Presigned GET lifetime for client downloads (5–15 min per the bucket policy). */
export const DEFAULT_PRESIGN_TTL_SECONDS = 10 * 60;

export const R2_REGION = 'auto';

export const LOCAL_META_SUFFIX = '.meta.json';
