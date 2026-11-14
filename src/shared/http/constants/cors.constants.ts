export const ALLOW_ANY_ORIGIN = '*';

/** Vercel preview deployments get a fresh subdomain per build. */
export const VERCEL_PREVIEW_SUFFIX = '.vercel.app';

/** `X-Capture-Key`: the shared key of the capture API (`/api/captures`), sent by other people's apps. */
export const ALLOWED_HEADERS = 'Authorization, Content-Type, X-Confirm, X-Capture-Key';

export const ALLOWED_METHODS = 'GET, POST, PATCH, DELETE, OPTIONS';

/**
 * Preflight cache. Without it Safari re-sends OPTIONS about every 5 s, so photos uploaded one by one from the
 * capture camera each paid an extra round trip to Render (planning-14112026/04). WebKit caps this at 600 s.
 */
export const CORS_MAX_AGE_SECONDS = 600;
