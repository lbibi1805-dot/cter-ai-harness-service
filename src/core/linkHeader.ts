/**
 * Pure HTTP `Link` header parser — extracted per PLAN_MODULE_ARCHITECTURE.md mục 6
 * Phase 0 step 4 / mục 4.C. Intended to eventually replace the two near-duplicate,
 * NOT-fully-equivalent implementations:
 *  - `canvasClient.ts`'s `parseLinkNext(linkHeader)` (hardcoded to `rel="next"`, only
 *    inspects the segment split at index 1 after the URL — i.e. exactly one `;`-part).
 *  - `conversationClient.ts`'s `parseLinkRel(linkHeader, rel)` (parametrized rel,
 *    inspects ALL `;`-separated params after the URL via `.some()`).
 *
 * These are NOT equivalent for a link-header segment with more than one param
 * (e.g. `<url>; foo="bar"; rel="next"`): `parseLinkNext` would miss it (only checks
 * the 2nd segment), `parseLinkRel` would find it (checks every segment). See
 * `linkHeader.test.ts` for the table-driven proof. This module is not wired into
 * either client yet — that migration (with a review of which behavior to standardize
 * on) happens in a later phase, per FIX #13.
 */
export function parseLinkRel(linkHeader: string | null, rel: string): string | null {
  if (!linkHeader) return null;
  for (const part of linkHeader.split(',')) {
    const [urlPart, ...params] = part.split(';');
    if (params.some(p => p.trim() === `rel="${rel}"`)) {
      const match = urlPart.trim().match(/^<(.+)>$/);
      if (match) return match[1];
    }
  }
  return null;
}
