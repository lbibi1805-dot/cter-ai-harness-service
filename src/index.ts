import { main } from './bootstrap/main';
import { errorMessage } from './shared/errors';
import { logger } from './shared/logging/logger';

const EXIT_FAILURE = 1;

main().catch((err: unknown) => {
  logger.error(`FATAL: ${errorMessage(err)}`);
  process.exit(EXIT_FAILURE);
});
