import { SHORT_NAME_MAX, VISIBLE_EDGE_CHARS, MIN_MASK_LENGTH } from '../constants/emailMask.constants';

export function maskName(value: string): string {
  if (value.length <= 1) return '*';
  if (value.length <= SHORT_NAME_MAX) return `${value.slice(0, VISIBLE_EDGE_CHARS)}***`;
  const hidden = '*'.repeat(Math.max(MIN_MASK_LENGTH, value.length - 2 * VISIBLE_EDGE_CHARS));
  return `${value.slice(0, VISIBLE_EDGE_CHARS)}${hidden}${value.slice(-VISIBLE_EDGE_CHARS)}`;
}
