import { createHash } from 'crypto';
import { ConfigurationError } from '../../../../shared/errors';
import {
  DEFAULT_PROMPT_ORDER,
  FRONTMATTER_DELIMITER,
  FRONTMATTER_TRUE,
  GLOB_WILDCARD,
  PROMPT_HASH_ALGORITHM,
  PROMPT_HASH_LENGTH,
  REQUIRED_PROMPT_FIELDS,
} from '../constants/prompt.constants';
import { PromptField } from '../enums/prompt.enums';
import type { PromptFrontmatter } from '../interfaces/prompt.interface';

const BOM = /^﻿/;
const LINE_BREAK = /\r?\n/;
const LIST_ITEM = /^\s*-\s+(.*)$/;
const KEY_VALUE = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/;
const INLINE_LIST = /^\[(.*)\]$/;
const QUOTED = /^(['"])(.*)\1$/;
const REGEX_SPECIAL = /[.+?^${}()|[\]\\]/g;
const COMMENT_PREFIX = '#';
const LIST_SEPARATOR = ',';

export function shortHash(text: string): string {
  return createHash(PROMPT_HASH_ALGORITHM).update(text, 'utf8').digest('hex').slice(0, PROMPT_HASH_LENGTH);
}

function unquote(value: string): string {
  const trimmed = value.trim();
  const quoted = QUOTED.exec(trimmed);
  return quoted ? quoted[2] : trimmed;
}

function readRawFrontmatter(lines: string[], filePath: string): Record<string, string | string[]> {
  const raw: Record<string, string | string[]> = {};
  let listKey: string | null = null;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(COMMENT_PREFIX)) continue;
    const item = LIST_ITEM.exec(line);
    if (item && listKey) {
      (raw[listKey] as string[]).push(unquote(item[1]));
      continue;
    }
    const pair = KEY_VALUE.exec(line);
    if (!pair) throw new ConfigurationError(`Prompt ${filePath}: unreadable frontmatter line "${trimmed}"`);
    const [, key, value] = pair;
    const inline = INLINE_LIST.exec(value.trim());
    listKey = null;
    if (inline) raw[key] = inline[1].split(LIST_SEPARATOR).map(unquote).filter(Boolean);
    else if (value.trim()) raw[key] = unquote(value);
    else {
      raw[key] = [];
      listKey = key;
    }
  }
  return raw;
}

/**
 * Splits a prompt file into frontmatter + body. Supports the YAML subset the prompt files use:
 * `key: value`, `key: [a, b]` and `key:` followed by `- item` lines. Throws (a startup failure) when the
 * frontmatter is missing or lacks a required field.
 */
export function parseFrontmatter(content: string, filePath: string): { meta: PromptFrontmatter; body: string } {
  const lines = content.replace(BOM, '').split(LINE_BREAK);
  if (lines[0]?.trim() !== FRONTMATTER_DELIMITER) throw new ConfigurationError(`Prompt ${filePath}: missing frontmatter (must start with "${FRONTMATTER_DELIMITER}")`);
  const end = lines.findIndex((line, i) => i > 0 && line.trim() === FRONTMATTER_DELIMITER);
  if (end < 0) throw new ConfigurationError(`Prompt ${filePath}: frontmatter is not closed with "${FRONTMATTER_DELIMITER}"`);

  const raw = readRawFrontmatter(lines.slice(1, end), filePath);
  for (const field of REQUIRED_PROMPT_FIELDS) {
    const value = raw[field];
    if (typeof value !== 'string' || !value) throw new ConfigurationError(`Prompt ${filePath}: frontmatter field "${field}" is required`);
  }
  const order = raw[PromptField.ORDER];
  const orderValue = typeof order === 'string' ? Number(order) : undefined;
  if (orderValue !== undefined && !Number.isFinite(orderValue)) throw new ConfigurationError(`Prompt ${filePath}: "${PromptField.ORDER}" must be a number`);
  const match = raw[PromptField.MATCH];
  const isStatic = raw[PromptField.STATIC];

  const meta: PromptFrontmatter = {
    id: raw[PromptField.ID] as string,
    version: raw[PromptField.VERSION] as string,
    owner: raw[PromptField.OWNER] as string,
    description: raw[PromptField.DESCRIPTION] as string,
    ...(orderValue !== undefined ? { order: orderValue } : {}),
    ...(match !== undefined ? { match: Array.isArray(match) ? match : [match] } : {}),
    ...(isStatic !== undefined ? { static: isStatic === FRONTMATTER_TRUE } : {}),
  };
  return { meta, body: lines.slice(end + 1).join('\n').trim() };
}

export function promptOrder(meta: PromptFrontmatter): number {
  return meta.order ?? DEFAULT_PROMPT_ORDER;
}

/** Case-insensitive prefix match, or an anchored glob when the pattern has `*`. */
export function matchesPattern(value: string, pattern: string): boolean {
  const subject = value.toLowerCase();
  const lowered = pattern.toLowerCase();
  if (!lowered.includes(GLOB_WILDCARD)) return subject.startsWith(lowered);
  const source = lowered.split(GLOB_WILDCARD).map((part) => part.replace(REGEX_SPECIAL, '\\$&')).join('.*');
  return new RegExp(`^${source}`).test(subject);
}
