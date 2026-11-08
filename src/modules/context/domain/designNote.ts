import { DESIGN_WORDS, LEVEL_WORDS, MASKED_COMPOUNDS } from './constants/artifactResolver.constants';
import {
  DESIGN_DECISION_WORDS,
  DESIGN_LIST_MIN_ITEMS,
  DESIGN_NOTE_MAX_DECISIONS,
  DESIGN_NOTE_MAX_ELEMENTS,
  DESIGN_NOTE_MAX_ITEM_CHARS,
  SYSTEM_NAME_PATTERN,
} from './constants/designNote.constants';
import { DesignNoteSource } from './enums/context.enums';
import { containsWord, maskCompounds } from './helpers/textMatch.helper';
import type { DesignNoteData } from './interfaces/context.interface';

const BULLET = /^\s*(?:[-*+•]|\d+[.)])\s+(.+)$/;
const TABLE_ROW = /^\s*\|(.+)\|\s*$/;
const TABLE_SEPARATOR = /^\s*\|?[\s:|-]*-{2,}[\s:|-]*\|?\s*$/;
const HEADING = /^\s*#{1,6}\s+(.+)$/;
const MARKDOWN_NOISE = /[*_`]/g;

/** The question asks for a design (design word or a C4 level). */
export function isDesignQuestion(question: string): boolean {
  return containsWord(maskCompounds(question, MASKED_COMPOUNDS), [...DESIGN_WORDS, ...Object.keys(LEVEL_WORDS)]);
}

function clean(text: string): string {
  return text.replace(MARKDOWN_NOISE, '').replace(/\s+/g, ' ').trim();
}

function tableRows(lines: string[]): string[][] {
  return lines.filter((l) => TABLE_ROW.test(l) && !TABLE_SEPARATOR.test(l))
    .map((l) => l.trim().replace(/^\||\|$/g, '').split('|').map(clean));
}

function hasTable(lines: string[]): boolean {
  return lines.some((l) => TABLE_ROW.test(l)) && lines.some((l) => TABLE_SEPARATOR.test(l));
}

function bullets(lines: string[]): string[] {
  return lines.map((l) => l.match(BULLET)?.[1]).filter((b): b is string => !!b).map(clean);
}

/** A design question answered at length, or with a component list / table → worth a design_note. */
export function isDesignAnswer(question: string, answer: string, minChars: number): boolean {
  if (!isDesignQuestion(question)) return false;
  const lines = answer.split('\n');
  return answer.length > minChars || hasTable(lines) || bullets(lines).length >= DESIGN_LIST_MIN_ITEMS;
}

function systemName(question: string, answer: string): string {
  const fromText = (text: string) => clean(text.match(SYSTEM_NAME_PATTERN)?.[0] ?? '');
  const heading = answer.split('\n').map((l) => l.match(HEADING)?.[1]).find(Boolean);
  return fromText(question) || fromText(answer) || clean(heading ?? '');
}

/** Element name of a list item / table row: the part before ":" / " - " / "—". */
function elementName(item: string): string {
  return item.split(/:|\s[-–—]\s/)[0].trim().slice(0, DESIGN_NOTE_MAX_ITEM_CHARS);
}

/** Heuristic data_json without any model: headings/bullets/table rows (refined later by the aux model). */
export function heuristicDesignNote(question: string, answer: string): DesignNoteData {
  const lines = answer.split('\n');
  const rows = tableRows(lines);
  const items = bullets(lines);
  const names = [...rows.slice(1).map((r) => r[0] ?? ''), ...items.map(elementName)].filter((n) => n && n.length <= DESIGN_NOTE_MAX_ITEM_CHARS);
  const decisions = [...items, ...lines.map(clean)]
    .filter((l) => containsWord(l, DESIGN_DECISION_WORDS))
    .map((l) => l.slice(0, DESIGN_NOTE_MAX_ITEM_CHARS * 3));
  return {
    systemName: systemName(question, answer),
    elements: [...new Set(names)].slice(0, DESIGN_NOTE_MAX_ELEMENTS).map((name) => ({ name })),
    decisions: [...new Set(decisions)].slice(0, DESIGN_NOTE_MAX_DECISIONS),
    extractedBy: DesignNoteSource.HEURISTIC,
  };
}

/** Parses the aux model's JSON reply; null when unusable. */
export function parseDesignNote(json: unknown): DesignNoteData | null {
  if (!json || typeof json !== 'object') return null;
  const o = json as Record<string, unknown>;
  const elements = Array.isArray(o.elements)
    ? o.elements.map((e) => (typeof e === 'string' ? { name: e } : e && typeof e === 'object' ? e as Record<string, unknown> : null))
      .filter((e): e is Record<string, unknown> => !!e && typeof e.name === 'string' && !!(e.name as string).trim())
      .map((e) => ({ name: String(e.name).trim(), ...(typeof e.tech === 'string' && e.tech.trim() ? { tech: e.tech.trim() } : {}) }))
    : [];
  const decisions = Array.isArray(o.decisions) ? o.decisions.filter((d): d is string => typeof d === 'string' && !!d.trim()).map((d) => d.trim()) : [];
  if (elements.length === 0 && decisions.length === 0) return null;
  return {
    systemName: typeof o.systemName === 'string' ? o.systemName.trim() : '',
    elements: elements.slice(0, DESIGN_NOTE_MAX_ELEMENTS),
    decisions: decisions.slice(0, DESIGN_NOTE_MAX_DECISIONS),
    extractedBy: DesignNoteSource.AUX,
  };
}
