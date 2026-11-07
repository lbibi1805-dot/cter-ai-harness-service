/** How aggressively `normalizeMathDelimiters` rewrites math. */
export enum MathNormalizeMode {
  /** Only `\(\)`, `\[\]` and `\begin{env}` are converted (chat answers sent to clients). */
  STRICT = 'strict',
  /** Strict conversions plus heuristics (bare `\cmd{}`, `(…)`/`[…]` guessing, space injection) — PDF path. */
  LOOSE = 'loose',
}

export enum TextSegmentKind {
  TEXT = 'text',
  INLINE_CODE = 'inline-code',
  FENCED_CODE = 'fenced-code',
}
