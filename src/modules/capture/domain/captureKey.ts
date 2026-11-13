import { ValidationError } from '../../../shared/errors';
import { ObjectPrefix } from '../../../shared/storage';
import {
  CAPTURE_FOLDER_MAX_LENGTH,
  CAPTURE_FOLDER_PATTERN,
  CAPTURE_IMAGE_NAME_PATTERN,
  CAPTURE_INDEX_DIGITS,
  CAPTURE_MAX_BATCH_INDEX,
  CAPTURE_SEQ_DIGITS,
} from './constants/capture.constants';
import { CAPTURE_EXTENSION, CaptureMimeType } from './enums/capture.enums';
import type { CaptureKeyParts } from './interfaces/capture.interface';

const COMBINING_MARKS = /[̀-ͯ]/g;
const NON_SLUG = /[^a-z0-9_-]+/g;
const EDGE_DASHES = /^-+|-+$/g;

/** "Bách Lê" → "bach-le". Throws when nothing usable is left. */
export function normalizeFolder(raw: unknown): string {
  if (typeof raw !== 'string') throw new ValidationError('folder is required (who took the photos, e.g. "bach")');
  const slug = raw.normalize('NFD').replace(COMBINING_MARKS, '').replace(/đ/gi, 'd').toLowerCase().trim()
    .replace(NON_SLUG, '-').replace(EDGE_DASHES, '').slice(0, CAPTURE_FOLDER_MAX_LENGTH);
  if (!CAPTURE_FOLDER_PATTERN.test(slug)) throw new ValidationError(`folder "${raw}" must contain letters or digits (max ${CAPTURE_FOLDER_MAX_LENGTH})`);
  return slug;
}

export function parseBatchIndex(raw: unknown): number {
  const text = typeof raw === 'number' ? String(raw) : typeof raw === 'string' ? raw.trim() : '';
  const index = /^\d{1,5}$/.test(text) ? Number(text) : NaN;
  if (!Number.isInteger(index) || index < 1 || index > CAPTURE_MAX_BATCH_INDEX) {
    throw new ValidationError(`batch index must be an integer 1–${CAPTURE_MAX_BATCH_INDEX}`);
  }
  return index;
}

export function batchPrefix(folder: string, index: number): string {
  return `${ObjectPrefix.CAPTURES}${folder}/${String(index).padStart(CAPTURE_INDEX_DIGITS, '0')}/`;
}

export function imageName(seq: number, id: string, mimeType: CaptureMimeType): string {
  return `${String(seq).padStart(CAPTURE_SEQ_DIGITS, '0')}-${id}.${CAPTURE_EXTENSION[mimeType]}`;
}

export function mimeTypeOfName(name: string): CaptureMimeType | null {
  const match = CAPTURE_IMAGE_NAME_PATTERN.exec(name);
  if (!match) return null;
  const entry = Object.entries(CAPTURE_EXTENSION).find(([, ext]) => ext === match[2]);
  return entry ? (entry[0] as CaptureMimeType) : null;
}

/** `captures/{folder}/{0007}/{01-abcdef}.jpg` → parts; null for anything else (foreign objects are ignored). */
export function parseCaptureKey(key: string): CaptureKeyParts | null {
  if (!key.startsWith(ObjectPrefix.CAPTURES)) return null;
  const parts = key.slice(ObjectPrefix.CAPTURES.length).split('/');
  if (parts.length !== 3) return null;
  const [folder, indexText, name] = parts;
  if (!CAPTURE_FOLDER_PATTERN.test(folder) || !/^\d{4}$/.test(indexText)) return null;
  const index = Number(indexText);
  const mimeType = mimeTypeOfName(name);
  if (index < 1 || !mimeType) return null;
  return { folder, index, name, seq: Number(CAPTURE_IMAGE_NAME_PATTERN.exec(name)![1]), mimeType };
}
