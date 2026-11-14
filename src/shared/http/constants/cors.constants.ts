export const ALLOW_ANY_ORIGIN = '*';

/** Vercel preview deployments get a fresh subdomain per build. */
export const VERCEL_PREVIEW_SUFFIX = '.vercel.app';

/** `X-Capture-Key`: the shared key of the capture API (`/api/captures`), sent by other people's apps. */
export const ALLOWED_HEADERS = 'Authorization, Content-Type, X-Confirm, X-Capture-Key';

export const ALLOWED_METHODS = 'GET, POST, PATCH, DELETE, OPTIONS';
