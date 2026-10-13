import * as fs from 'fs';
import * as path from 'path';
import { parseGoldenSet, type GoldenItem } from '../domain';

export const DEFAULT_GOLDEN_FILE = path.resolve(__dirname, '..', 'golden.jsonl');
export const EXAMPLE_GOLDEN_FILE = path.resolve(__dirname, '..', 'golden.example.jsonl');

/** Uses golden.jsonl when present, otherwise the committed example set. */
export function loadGoldenSet(file?: string): { file: string; items: GoldenItem[] } {
  const resolved = file ? path.resolve(file) : fs.existsSync(DEFAULT_GOLDEN_FILE) ? DEFAULT_GOLDEN_FILE : EXAMPLE_GOLDEN_FILE;
  return { file: resolved, items: parseGoldenSet(fs.readFileSync(resolved, 'utf-8')) };
}
