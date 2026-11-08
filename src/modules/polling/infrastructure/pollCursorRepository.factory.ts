import type { PollCursorRepository } from '../domain';
import { FilePollCursorRepository } from './filePollCursor.repository';
import { NeonPollCursorRepository } from './neonPollCursor.repository';
import { getNeonSql, usesNeon } from '../../../shared/database/helpers/database.helper';
import { DatabaseSettings } from '../../../shared/database/interfaces/database.interface';
import { neonSqlClient } from '../../../shared/database/neonSqlClient';

export function createPollCursorRepository(settings: DatabaseSettings): PollCursorRepository {
  return usesNeon(settings)
    ? new NeonPollCursorRepository(neonSqlClient(getNeonSql(settings.databaseUrl)))
    : new FilePollCursorRepository();
}
