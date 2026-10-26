import { VERCEL_PREVIEW_SUFFIX } from '../constants/cors.constants';

export function withoutTrailingSlash(value: string): string {
  return value.replace(/\/$/, '');
}

export function isVercelPreview(origin: string): boolean {
  return origin.endsWith(VERCEL_PREVIEW_SUFFIX);
}
