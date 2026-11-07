// ── Math delimiter normalization ─────────────────────────────────────────────
// Used by the PDF renderer (loose) and for chat answers sent to clients (strict).
// The client (cter-interview-cloak-client, MathDelimiters.cs) ports strict mode and
// runs the same fixture: tests/fixtures/math-delimiters.json — keep them in sync.
import { splitCodeSegments } from './codeSegments';
import { MathNormalizeMode, TextSegmentKind } from './enums/text.enums';
import { normalizeLoose, normalizeStrict } from './helpers/mathNormalizer.helper';
import type { MathNormalizeOptions } from './interfaces/text.interface';

/**
 * Rewrites LaTeX math to `$…$` / `$$…$$`. Code (fenced blocks, inline code spans — see
 * `splitCodeSegments`) is never touched, in either mode.
 *
 * Strict mode (the client contract), left to right over each prose segment:
 * - `\\` and `\$` are copied as a unit (`\$` is a literal dollar, never math).
 * - Existing math is copied verbatim: `$$…$$` (may span lines; unclosed `$$` is literal), and
 *   `$…$` per the Pandoc rule (opening `$` + non-space, closing `$` after a non-space and not
 *   before a digit, no blank line inside) — so "Giá $5 và $10" is not math.
 * - `\(…\)` → `$…$`, `\[…\]` → `$$…$$`, inner content trimmed; unterminated or empty → as-is.
 * - `\begin{env}…\end{env}`: equation, equation*, displaymath → `$$inner$$`; align(*), eqnarray(*)
 *   → `$$\begin{aligned}inner\end{aligned}$$`; gather(*) → `$$\begin{gathered}inner\end{gathered}$$`;
 *   any other env → `$$\begin{env}…\end{env}$$`; unterminated → as-is.
 * - Closers (`\)`, `\]`, `\end{env}`, `$$`, `$`) are searched skipping `\x` escape pairs.
 * - Nothing else (no bare `\cmd{}` wrapping, no `(…)`/`[…]` guessing, no space injection).
 *
 * Loose mode (default, PDF): the historical heuristics — the conversions above in their
 * original form plus bare `\cmd{}`, `(…)`/`[…]` guessing and space injection around `$…$`.
 */
export function normalizeMathDelimiters(text: string, opts?: MathNormalizeOptions): string {
  const normalize = opts?.mode === MathNormalizeMode.STRICT ? normalizeStrict : normalizeLoose;
  return splitCodeSegments(text)
    .map((segment) => (segment.kind === TextSegmentKind.TEXT ? normalize(segment.text) : segment.text))
    .join('');
}
