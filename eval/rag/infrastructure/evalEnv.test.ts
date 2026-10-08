import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { EvalEmbeddingProvider } from '../domain';
import { loadEvalSettings, maskSecret } from './evalEnv';

let dir: string;
const write = (content: string) => {
  const file = path.join(dir, '.env.eval');
  fs.writeFileSync(file, content);
  return file;
};

describe('loadEvalSettings', () => {
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'evalenv-')); });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('reads credentials from the eval file without touching process.env', () => {
    const before = process.env.PINECONE_INDEX;
    const settings = loadEvalSettings(write('PINECONE_API_KEY=pcsk_secret\nPINECONE_INDEX=prod-idx\nEMBEDDING_PROVIDER=openai\nOPENAI_API_KEY=sk-x\n'));
    expect(settings).toEqual({
      pineconeApiKey: 'pcsk_secret', pineconeIndex: 'prod-idx', embeddingProvider: EvalEmbeddingProvider.OPENAI,
      openaiApiKey: 'sk-x', geminiApiKey: undefined,
    });
    expect(process.env.PINECONE_INDEX).toBe(before);
  });

  it('explains how to create the file when it is missing', () => {
    expect(() => loadEvalSettings(path.join(dir, 'nope'))).toThrow(/Copy eval\/.env.eval.example/);
  });

  it('requires the key of the selected embedding provider', () => {
    expect(() => loadEvalSettings(write('PINECONE_API_KEY=k\nPINECONE_INDEX=i\nEMBEDDING_PROVIDER=gemini\nOPENAI_API_KEY=sk\n')))
      .toThrow(/GEMINI_API_KEY is empty/);
  });

  it('rejects an unknown provider', () => {
    expect(() => loadEvalSettings(write('PINECONE_API_KEY=k\nPINECONE_INDEX=i\nEMBEDDING_PROVIDER=cohere\n'))).toThrow(/must be one of/);
  });

  it('masks secrets for logging', () => {
    expect(maskSecret('pcsk_1234567890abc')).toBe('pcsk…abc');
    expect(maskSecret('short')).toBe('****');
  });
});
