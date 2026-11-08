import { MARKDOWN_HEADING, REVIEW_MATCH_ORDER, REVIEW_SECTIONS, REVIEW_TABLE_HEADER, TABLE_ROW } from './constants/reviewFrame.constants';

function sectionOf(heading: string, taken: Set<number>): number {
  const text = heading.normalize('NFC').toLowerCase();
  return REVIEW_MATCH_ORDER.find((i) => !taken.has(i) && REVIEW_SECTIONS[i].keys.some((key) => text.includes(key))) ?? -1;
}

/**
 * Puts a model-written review into the fixed frame (note 05 §6): the five sections in order, each with
 * its canonical heading; a missing section gets a placeholder, text before the first heading becomes the
 * summary, unknown headings stay inside the section they follow, the criteria table always has its header.
 */
export function ensureReviewFrame(markdown: string): string {
  const bodies: string[][] = REVIEW_SECTIONS.map(() => []);
  const taken = new Set<number>();
  let current = 0;
  for (const line of markdown.replace(/\r\n/g, '\n').split('\n')) {
    const heading = MARKDOWN_HEADING.exec(line);
    if (heading) {
      const index = sectionOf(heading[1], taken);
      if (index >= 0) {
        taken.add(index);
        current = index;
        continue;
      }
    }
    bodies[current].push(line);
  }
  const tableIndex = 1;
  const table = bodies[tableIndex];
  if (table.some((line) => TABLE_ROW.test(line)) && !table.some((line) => /tiêu chí/i.test(line) && TABLE_ROW.test(line))) {
    const first = table.findIndex((line) => TABLE_ROW.test(line));
    table.splice(first, 0, ...REVIEW_TABLE_HEADER.split('\n'));
  }
  return REVIEW_SECTIONS.map((section, i) => {
    const body = bodies[i].join('\n').trim();
    return `${section.heading}\n\n${body || section.placeholder}`;
  }).join('\n\n');
}
