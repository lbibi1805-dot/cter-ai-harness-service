import {
  CITATION_ID_SEPARATOR,
  CITATION_MARKER,
  CITATION_MARKER_WITH_SPACE,
  ESSAY_BLOCK,
  ESSAY_CLOSE,
  ESSAY_OPEN,
  LEADING_OUTLINE,
  LEADING_WHITESPACE,
  NO_SOURCE_ID,
  OUTLINE_BLOCK,
  WORD,
} from '../constants/essay.constants';
import type { CitationCheck, EssayOutput } from '../interfaces/essay.interface';

/** `<outline>…</outline><essay>…</essay>` → parts. Without an `<essay>` tag the text after the outline is the essay. */
export function splitEssayOutput(text: string): EssayOutput {
  const outline = OUTLINE_BLOCK.exec(text)?.[1]?.trim() ?? '';
  const essayMatch = ESSAY_BLOCK.exec(text);
  const essay = essayMatch ? essayMatch[1] : text.replace(LEADING_OUTLINE, '');
  return { outline, essay: essay.trim() };
}

function citedIds(text: string): string[] {
  return [...text.matchAll(CITATION_MARKER)].flatMap((match) => match[1].split(CITATION_ID_SEPARATOR).map((id) => id.trim()).filter(Boolean));
}

/** Splits the `[c:<id>]` ids into those sent in the prompt and unknown (fabricated) ones; `[c:none]` is neither. */
export function checkCitations(text: string, knownIds: ReadonlySet<string>): CitationCheck {
  const valid: string[] = [];
  const unknown: string[] = [];
  for (const id of citedIds(text)) {
    if (id.toLowerCase() === NO_SOURCE_ID) continue;
    const bucket = knownIds.has(id) ? valid : unknown;
    if (!bucket.includes(id)) bucket.push(id);
  }
  return { valid, unknown };
}

/** Keeps only known ids in each marker; a marker left empty is removed. */
export function dropUnknownCitations(text: string, knownIds: ReadonlySet<string>): string {
  return text.replace(CITATION_MARKER, (_, inner: string) => {
    const ids = inner.split(CITATION_ID_SEPARATOR).map((id) => id.trim()).filter((id) => knownIds.has(id) || id.toLowerCase() === NO_SOURCE_ID);
    return ids.length ? `[c:${ids.join(', ')}]` : '';
  });
}

/** The essay as shown: no `[c:…]` markers (they belong to the outline). */
export function stripCitationMarkers(text: string): string {
  return text.replace(CITATION_MARKER_WITH_SPACE, '');
}

export function countWords(text: string): number {
  return text.match(WORD)?.length ?? 0;
}

/**
 * Streams only the `<essay>` part of the model output: everything before `<essay>` (the outline) is held
 * back, `</essay>` and what follows are dropped. Tags split across deltas are handled.
 */
export class EssayStreamFilter {
  private buffer = '';
  private started = false;
  private ended = false;
  private emittedText = false;

  /** Text to forward for this delta ('' while in the outline). */
  push(delta: string): string {
    if (this.ended) return '';
    this.buffer += delta;
    if (!this.started) {
      const open = this.buffer.indexOf(ESSAY_OPEN);
      if (open < 0) return '';
      this.started = true;
      this.buffer = this.buffer.slice(open + ESSAY_OPEN.length).replace(/^\s+/, '');
    }
    const close = this.buffer.indexOf(ESSAY_CLOSE);
    if (close >= 0) {
      this.ended = true;
      return this.emit(this.buffer.slice(0, close));
    }
    const held = heldTail(this.buffer, ESSAY_CLOSE);
    const out = this.buffer.slice(0, this.buffer.length - held);
    this.buffer = this.buffer.slice(this.buffer.length - held);
    return this.emit(out);
  }

  /** Text still held at the end of the stream (an unterminated essay). */
  flush(): string {
    if (!this.started || this.ended) return '';
    const out = this.buffer;
    this.buffer = '';
    return this.emit(out);
  }

  /** The continuation of a cut essay starts inside `<essay>` (08 Bước 4): forward from the first delta. */
  resume(): void {
    this.started = true;
  }

  reset(): void {
    this.buffer = '';
    this.started = false;
    this.ended = false;
    this.emittedText = false;
  }

  /** True once any essay text went out. */
  emitted(): boolean {
    return this.emittedText;
  }

  private emit(text: string): string {
    if (text) this.emittedText = true;
    return text;
  }
}

/** Length of the longest suffix of `text` that is a prefix of `tag` (it may be the start of the tag). */
function heldTail(text: string, tag: string): number {
  for (let length = Math.min(tag.length - 1, text.length); length > 0; length--) {
    if (tag.startsWith(text.slice(text.length - length))) return length;
  }
  return 0;
}
