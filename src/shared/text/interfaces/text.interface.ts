import type { MathNormalizeMode, TextSegmentKind } from '../enums/text.enums';

export interface MathNormalizeOptions {
  /** Defaults to `'loose'` (the PDF behaviour). */
  mode?: `${MathNormalizeMode}`;
}

/** A fenced code block split into its parts; `open + body + close` is the original text. */
export interface FencedCodeParts {
  /** Opening fence line including its line break. */
  open: string;
  /** Info string of the opening fence, trimmed (e.g. `mermaid`, `python`, empty). */
  info: string;
  /** Lines between the fences (each with its line break). */
  body: string;
  /** Closing fence line (no trailing line break); empty when the fence runs to the end of the text. */
  close: string;
}

/** Concatenating every segment's `text` gives back the input exactly. */
export interface TextSegment {
  kind: TextSegmentKind;
  text: string;
  /** Only for `FENCED_CODE`. */
  fence?: FencedCodeParts;
}
