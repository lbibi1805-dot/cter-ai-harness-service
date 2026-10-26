import * as fs from 'fs';
import * as path from 'path';
import type { PollCursorRepository, PollJobName } from '../domain';
import { DEFAULT_CURSOR_FILE } from './constants/filePollCursor.constants';
import { cursorKey } from './helpers/filePollCursor.helper';
import { CursorFile } from './interfaces/filePollCursor.interface';

/** Local JSON fallback for development; production uses Neon. */
export class FilePollCursorRepository implements PollCursorRepository {
  private readonly filePath: string;

  constructor(filePath: string = DEFAULT_CURSOR_FILE) {
    this.filePath = path.resolve(process.cwd(), filePath);
  }

  async get(job: PollJobName, accountIndex: number): Promise<Date | null> {
    const value = this.read()[cursorKey(job, accountIndex)];
    return value ? new Date(value) : null;
  }

  async save(job: PollJobName, accountIndex: number, cursor: Date): Promise<void> {
    const data = this.read();
    const key = cursorKey(job, accountIndex);
    if (data[key] && new Date(data[key]) >= cursor) return;
    data[key] = cursor.toISOString();
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  private read(): CursorFile {
    try {
      return JSON.parse(fs.readFileSync(this.filePath, 'utf-8')) as CursorFile;
    } catch {
      return {};
    }
  }
}
