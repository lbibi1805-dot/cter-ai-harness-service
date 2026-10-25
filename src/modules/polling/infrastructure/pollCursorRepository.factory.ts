import type { PollCursorRepository } from '../domain';
import { FilePollCursorRepository } from './filePollCursor.repository';
import { NeonPollCursorRepository } from './neonPollCursor.repository';
import { getNeonSql, usesNeon } from '../../../shared/database/helpers/database.helper';
import { DatabaseSettings } from '../../../shared/database/interfaces/database.interface';

export function createPollCursorRepository(settings: DatabaseSettings): PollCursorRepository {
  return usesNeon(settings)
    ? new NeonPollCursorRepository(getNeonSql(settings.databaseUrl))
    : new FilePollCursorRepository();
}
