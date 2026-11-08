/**
 * Unicode-aware word matching (note 17 §3.1): NFC + lower case, and a word only
 * matches between non-letters — `nó` no longer matches "nói". Compound words that
 * contain a cue as a separate syllable ("vấn đề" for `đề`) are masked first.
 */

const DIACRITICS = /\p{M}/gu;
const NON_WORD = /[^\p{L}\p{N}]+/u;
const REGEX_SPECIALS = /[.*+?^${}()|[\]\\]/g;
const MASK = ' · ';

const patternCache = new Map<string, RegExp>();

export function normalizeText(text: string): string {
  return text.normalize('NFC').toLowerCase();
}

/** "Hệ thống đặt vé" → "he thong dat ve" (đ → d too). */
export function stripDiacritics(text: string): string {
  return normalizeText(text).normalize('NFD').replace(DIACRITICS, '').replace(/đ/g, 'd').normalize('NFC');
}

export function hasDiacritics(token: string): boolean {
  return stripDiacritics(token) !== normalizeText(token);
}

function wordPattern(word: string): RegExp {
  let pattern = patternCache.get(word);
  if (!pattern) {
    const escaped = normalizeText(word).trim().replace(REGEX_SPECIALS, '\\$&').replace(/\s+/g, '\\s+');
    pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'u');
    patternCache.set(word, pattern);
  }
  return pattern;
}

/** Normalized text with the given compounds blanked out (so their syllables never match alone). */
export function maskCompounds(text: string, compounds: readonly string[]): string {
  let masked = normalizeText(text);
  for (const compound of compounds) {
    const pattern = new RegExp(wordPattern(compound).source, 'gu');
    masked = masked.replace(pattern, MASK);
  }
  return masked;
}

/** True when one of the words/phrases occurs as whole words (text should be normalized/masked). */
export function containsWord(text: string, words: readonly string[]): boolean {
  const normalized = normalizeText(text);
  return words.some((w) => wordPattern(w).test(normalized));
}

/** Word tokens (normalized, diacritics kept). */
export function tokenize(text: string): string[] {
  return normalizeText(text).split(NON_WORD).filter(Boolean);
}
