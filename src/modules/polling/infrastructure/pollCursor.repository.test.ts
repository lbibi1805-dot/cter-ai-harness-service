import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { NeonSql } from '../../../shared/database/database';
import { PollJobName } from '../domain';
import { FilePollCursorRepository } from './filePollCursor.repository';
import { NeonPollCursorRepository } from './neonPollCursor.repository';
import { POLL_CURSOR_SCHEMA_STATEMENTS } from './pollCursorSchema';

const T1 = new Date('2026-10-01T10:00:00Z');
const T2 = new Date('2026-10-01T11:00:00Z');

describe('FilePollCursorRepository', () => {
  let dir: string;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cursor-')); });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('stores cursors per (job, account) and survives a new instance (restart)', async () => {
    const file = path.join(dir, 'nested', 'cursors.json');
    await new FilePollCursorRepository(file).save(PollJobName.FILE_QA, 1, T1);
    const reopened = new FilePollCursorRepository(file);
    expect(await reopened.get(PollJobName.FILE_QA, 1)).toEqual(T1);
    expect(await reopened.get(PollJobName.FILE_QA, 2)).toBeNull();
    expect(await reopened.get(PollJobName.CONVERSATION, 1)).toBeNull();
  });

  it('never moves a cursor backwards', async () => {
    const repo = new FilePollCursorRepository(path.join(dir, 'c.json'));
    await repo.save(PollJobName.FILE_QA, 1, T2);
    await repo.save(PollJobName.FILE_QA, 1, T1);
    expect(await repo.get(PollJobName.FILE_QA, 1)).toEqual(T2);
  });

  it('treats a corrupt file as empty', async () => {
    const file = path.join(dir, 'c.json');
    fs.writeFileSync(file, '{not json');
    expect(await new FilePollCursorRepository(file).get(PollJobName.FILE_QA, 1)).toBeNull();
  });
});

describe('NeonPollCursorRepository', () => {
  function fakeSql(rows: unknown[] = []) {
    const query = vi.fn(async (_text: string, _params?: unknown[]) => rows);
    return { sql: { query } as unknown as NeonSql, query };
  }

  it('creates the table once, then reads with parameters', async () => {
    const { sql, query } = fakeSql([{ cursor_at: '2026-10-01T10:00:00.000Z' }]);
    const repo = new NeonPollCursorRepository(sql);
    expect(await repo.get(PollJobName.FILE_QA, 3)).toEqual(T1);
    await repo.get(PollJobName.FILE_QA, 3);
    const ddlCalls = query.mock.calls.filter(([text]) => text.startsWith('CREATE TABLE'));
    expect(ddlCalls).toHaveLength(POLL_CURSOR_SCHEMA_STATEMENTS.length);
    expect(query.mock.calls.at(-1)![1]).toEqual([PollJobName.FILE_QA, 3]);
  });

  it('upserts with GREATEST so concurrent writers cannot move it backwards', async () => {
    const { sql, query } = fakeSql();
    await new NeonPollCursorRepository(sql).save(PollJobName.FILE_QA, 1, T2);
    const [text, params] = query.mock.calls.at(-1)!;
    expect(text).toContain('GREATEST(poll_cursor.cursor_at, EXCLUDED.cursor_at)');
    expect(params).toEqual([PollJobName.FILE_QA, 1, T2.toISOString()]);
  });
});
