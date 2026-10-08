import { getNeonSql, usesNeon, type DatabaseSettings } from '../../../shared/database/database';
import type { PollCursorRepository } from '../domain';
import { FilePollCursorRepository } from './filePollCursor.repository';
import { NeonPollCursorRepository } from './neonPollCursor.repository';

export function createPollCursorRepository(settings: DatabaseSettings): PollCursorRepository {
  return usesNeon(settings)
    ? new NeonPollCursorRepository(getNeonSql(settings.databaseUrl))
    : new FilePollCursorRepository();
}
