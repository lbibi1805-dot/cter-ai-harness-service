import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import type { AddressInfo } from 'net';
import type { NeonSql } from '../../../src/shared/database/database';
import { AnswerMode } from '../../../src/modules/agent/domain';
import type { AnswerEvalReport } from '../domain';
import { loadAnswerEvalSettings } from './answerEvalEnv';
import { loadBaseline, saveAnswerReport } from './answerRunStore';
import { OpenAIJudge, buildJudgeUserPrompt, parseVerdict } from './openaiJudge';
import { REFERENCE_CHARS_PER_FILE, ReadOnlyNeonVaultRepository, VaultReferenceLoader } from './readOnlyVault';

const ITEM = { id: 'q', question: 'What is a mutex?', expectedSources: ['a.md'], keyPoints: ['owner', 'unlock'], answerable: true };

describe('judge verdict parsing', () => {
  it('normalises shape and types, aligns key points', () => {
    const verdict = parseVerdict(JSON.stringify({
      claims: [{ text: 'a', supported: true }, { text: 'b', supported: 'yes' }, null],
      key_points_covered: [true],
      relevance: 9,
      refused: false,
      notes: 'ok',
    }), 3);
    expect(verdict).toEqual({
      claims: [{ text: 'a', supported: true }, { text: 'b', supported: false }],
      keyPointsCovered: [true, false, false],
      relevance: 5,
      refused: false,
      notes: 'ok',
    });
  });

  it('rejects non-JSON', () => {
    expect(() => parseVerdict('not json', 1)).toThrow();
  });

  it('tells the judge when no reference exists', () => {
    expect(buildJudgeUserPrompt({ item: { ...ITEM, answerable: false, expectedSources: [], keyPoints: [] }, answer: 'x', referenceText: '' }))
      .toContain('the course vault does not cover this question');
  });
});

describe('OpenAIJudge (real SDK against a fake chat-completions endpoint)', () => {
  const bodies: Array<Record<string, unknown>> = [];
  let status = 200;
  const server = http.createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    bodies.push(JSON.parse(Buffer.concat(chunks).toString()));
    if (status !== 200) {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end('{"error":{"message":"busy"}}');
      status = 200;
      return;
    }
    const content = JSON.stringify({ claims: [{ text: 'a mutex has an owner', supported: true }], key_points_covered: [true, false], relevance: 4, refused: false, notes: '' });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ id: 'c', object: 'chat.completion', created: 0, model: 'judge', choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content } }] }));
  });
  let baseURL = '';

  beforeAll(async () => {
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    baseURL = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
  });
  afterAll(() => new Promise<void>((r) => server.close(() => r())));
  beforeEach(() => { bodies.length = 0; });

  it('requests JSON mode with temperature 0 for non-reasoning models', async () => {
    const verdict = await new OpenAIJudge('k', 'gpt-4o', async () => undefined, baseURL).judge({ item: ITEM, answer: 'A mutex has an owner.', referenceText: 'REF' });
    expect(verdict.keyPointsCovered).toEqual([true, false]);
    expect(bodies[0]).toMatchObject({ model: 'gpt-4o', response_format: { type: 'json_object' }, temperature: 0 });
  });

  it('omits temperature for reasoning models and retries transient errors', async () => {
    status = 503;
    await new OpenAIJudge('k', 'gpt-5', async () => undefined, baseURL).judge({ item: ITEM, answer: 'x', referenceText: 'REF' });
    expect(bodies).toHaveLength(2);
    expect(bodies[1]).not.toHaveProperty('temperature');
  });
});

describe('ReadOnlyNeonVaultRepository', () => {
  function fakeSql(rows: unknown[] = []) {
    const query = vi.fn(async (_text: string, _params?: unknown[]) => rows);
    return { sql: { query } as unknown as NeonSql, query };
  }

  it('only ever issues SELECT statements (no schema DDL)', async () => {
    const { sql, query } = fakeSql([{ file_path: 'a/b.md', hash: 'h', chunk_ids: [], indexed: true, updated_at: '2026-01-01', content: 'x', total: 1 }]);
    const repo = new ReadOnlyNeonVaultRepository(sql);
    await repo.findByPath('a/b.md');
    await repo.findByFolder('a');
    await repo.findAll();
    await repo.listFolders();
    await repo.stats();
    expect(query.mock.calls.every(([text]) => /^SELECT\b/.test(text))).toBe(true);
  });

  it('refuses every write', async () => {
    const repo = new ReadOnlyNeonVaultRepository(fakeSql().sql);
    await expect(repo.save()).rejects.toThrow(/never writes/);
    await expect(repo.remove()).rejects.toThrow(/never writes/);
    await expect(repo.removeAll()).rejects.toThrow(/never writes/);
  });

  it('reference loader truncates documents and flags missing ones', async () => {
    const loader = new VaultReferenceLoader({
      findByPath: async (p) => (p === 'big.md' ? { filePath: p, content: 'x'.repeat(REFERENCE_CHARS_PER_FILE + 50), hash: '', chunkIds: [], indexed: true, updatedAt: '' } : null),
    });
    const text = await loader.load(['big.md', 'missing.md']);
    expect(text).toContain(`### SOURCE: big.md\n${'x'.repeat(REFERENCE_CHARS_PER_FILE)}\n`);
    expect(text).toContain('### SOURCE: missing.md\n(missing from the vault — fix the golden label)');
  });
});

describe('settings and run store', () => {
  let dir: string;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'answer-eval-')); });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  const writeEnv = (extra: string) => {
    const file = path.join(dir, '.env.eval');
    fs.writeFileSync(path.join(dir, 'prompt.md'), 'SYSTEM');
    fs.writeFileSync(file, `PINECONE_API_KEY=pk\nPINECONE_INDEX=idx\nEMBEDDING_PROVIDER=openai\nOPENAI_API_KEY=sk\nSYSTEM_PROMPT_FILE=${path.join(dir, 'prompt.md')}\n${extra}`);
    return file;
  };

  it('loads answer-eval settings with defaults', () => {
    expect(loadAnswerEvalSettings(writeEnv('DATABASE_URL=postgres://x\n'))).toMatchObject({
      databaseUrl: 'postgres://x', answerModel: 'gpt-6-astra', judgeModel: 'gpt-4o', ragTopK: 20, systemPrompt: 'SYSTEM',
    });
  });

  it('requires DATABASE_URL and a Responses-API answer model', () => {
    expect(() => loadAnswerEvalSettings(writeEnv(''))).toThrow(/DATABASE_URL is required/);
    expect(() => loadAnswerEvalSettings(writeEnv('DATABASE_URL=x\nANSWER_MODEL=gpt-4o\n'))).toThrow(/cannot run agent mode/);
  });

  it('saves runs and resolves "latest" to the newest one', () => {
    const report = (label: string, startedAt: string): AnswerEvalReport => ({
      label, startedAt, durationMs: 0,
      settings: { answerModel: 'm', judgeModel: 'j', modes: [AnswerMode.AGENT], repeats: 1, questionCount: 0 },
      environment: { vaultFiles: 1, vaultIndexed: 1, vectorCount: 1, embeddingProvider: 'openai', pineconeIndex: 'i' },
      summaries: [], samples: [],
    });
    expect(loadBaseline('latest', dir)).toBeNull();
    saveAnswerReport(report('first', '2026-10-01T00:00:00.000Z'), dir);
    const second = saveAnswerReport(report('second', '2026-10-02T00:00:00.000Z'), dir);
    expect(loadBaseline('latest', dir)?.label).toBe('second');
    expect(loadBaseline(second.json)?.label).toBe('second');
    expect(fs.readFileSync(second.markdown, 'utf-8')).toContain('# Answer eval — second');
  });
});
