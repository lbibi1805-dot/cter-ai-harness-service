import { DISCUSSION_MATCH_ORDER, DISCUSSION_NUMBER, DISCUSSION_PLACEHOLDER, DISCUSSION_SECTIONS } from './constants/discussionFrame.constants';
import { MARKDOWN_HEADING } from './constants/reviewFrame.constants';

function topicOf(heading: string, taken: Set<number>): number {
  const text = heading.normalize('NFC').toLowerCase().replace(/[*_`]/g, '');
  const numbered = DISCUSSION_NUMBER.exec(text);
  if (numbered) {
    const index = Number(numbered[1]) - 1;
    if (!taken.has(index)) return index;
  }
  return DISCUSSION_MATCH_ORDER.find((i) => !taken.has(i) && DISCUSSION_SECTIONS[i].keys.some((key) => text.includes(key))) ?? -1;
}

/**
 * Puts a model-written design discussion into the fixed frame (plan 04 §5.3): the seven topics T1–T7 in
 * order with their canonical headings; a missing topic gets "Chưa phân tích" instead of another model call;
 * text before the first topic stays on top as an introduction; unknown headings stay inside the topic they follow.
 */
export function ensureDiscussionFrame(markdown: string): string {
  const intro: string[] = [];
  const bodies: string[][] = DISCUSSION_SECTIONS.map(() => []);
  const taken = new Set<number>();
  let current = -1;
  for (const line of markdown.replace(/\r\n/g, '\n').split('\n')) {
    const heading = MARKDOWN_HEADING.exec(line);
    if (heading) {
      const index = topicOf(heading[1], taken);
      if (index >= 0) {
        taken.add(index);
        current = index;
        continue;
      }
    }
    (current < 0 ? intro : bodies[current]).push(line);
  }
  const sections = DISCUSSION_SECTIONS.map((section, i) => `${section.heading}\n\n${bodies[i].join('\n').trim() || DISCUSSION_PLACEHOLDER}`);
  const head = intro.join('\n').trim();
  return [head, ...sections].filter(Boolean).join('\n\n');
}

/** Topics (1-based) the model actually wrote, for evals and logs. */
export function discussionTopicsPresent(markdown: string): number[] {
  const framed = ensureDiscussionFrame(markdown);
  return DISCUSSION_SECTIONS
    .map((section, i) => {
      const start = framed.indexOf(section.heading);
      const next = i + 1 < DISCUSSION_SECTIONS.length ? framed.indexOf(DISCUSSION_SECTIONS[i + 1].heading) : framed.length;
      const body = framed.slice(start + section.heading.length, next).trim();
      return body && body !== DISCUSSION_PLACEHOLDER ? i + 1 : 0;
    })
    .filter((n) => n > 0);
}
