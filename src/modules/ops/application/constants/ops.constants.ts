import { LogTag } from '../../../../shared/logging/enums/logger.enums';

export const AI_ACTIVITY_TAGS: ReadonlySet<LogTag> = new Set([LogTag.AI, LogTag.RETRY, LogTag.FAILED]);
