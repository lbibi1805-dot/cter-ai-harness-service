import { describe, it, expect } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'http';
import { applyCors, resolveAllowedOrigin } from '../../../../src/shared/http/cors';

function fakeRes() {
  const headers = new Map<string, string>();
  return { headers, res: { setHeader: (k: string, v: string) => { headers.set(k.toLowerCase(), v); } } as unknown as ServerResponse };
}

describe('applyCors', () => {
  it('caches the preflight for 600 s (planning-14112026/04)', () => {
    const { headers, res } = fakeRes();
    applyCors({ headers: { origin: 'https://capture.vercel.app' } } as IncomingMessage, res, []);
    expect(headers.get('access-control-max-age')).toBe('600');
    expect(headers.get('access-control-allow-origin')).toBe('https://capture.vercel.app');
    expect(headers.get('access-control-allow-methods')).toContain('POST');
  });

  it('keeps the allow-list behaviour', () => {
    expect(resolveAllowedOrigin('https://evil.example', ['https://ok.example'])).toBe('https://ok.example');
    expect(resolveAllowedOrigin('https://x-git-y.vercel.app', ['https://ok.example'])).toBe('https://x-git-y.vercel.app');
  });
});
