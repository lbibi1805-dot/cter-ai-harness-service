import { mapMathChar } from './helpers/textNormalizer.helper';

export function normalizeText(text: string): string {
  return text.replace(/[\u{1D400}-\u{1D7FF}]/gu, mapMathChar);
}
