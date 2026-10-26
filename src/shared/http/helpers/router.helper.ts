import { PathMatcher } from '../interfaces/router.interface';

export function exactPath(path: string): PathMatcher {
  return (pathname) => (pathname === path ? {} : null);
}

/** Matches `<prefix><anything><suffix>` and exposes the decoded middle as `params.path`. */
export function wildcardPath(prefix: string, suffix = ''): PathMatcher {
  return (pathname) => {
    if (!pathname.startsWith(prefix) || !pathname.endsWith(suffix)) return null;
    if (pathname.length <= prefix.length + suffix.length) return null;
    return { path: decodeURIComponent(pathname.slice(prefix.length, pathname.length - suffix.length)) };
  };
}
