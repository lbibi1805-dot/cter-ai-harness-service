import { MAX_LISTED_ITEMS } from '../../domain';

export function limited(lines: string[], noun: string): string {
  const shown = lines.slice(0, MAX_LISTED_ITEMS);
  const more = lines.length > shown.length ? `\n…and ${lines.length - shown.length} more ${noun}` : '';
  return shown.join('\n') + more;
}
