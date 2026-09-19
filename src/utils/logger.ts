// Backward-compat re-export — new code should import from infrastructure/logger
export { ConsoleLogger, logger } from '../infrastructure/logger/ConsoleLogger';
export type { ILogger } from '../domain/ports/ILogger';
// Keep Logger class name for legacy imports
export { ConsoleLogger as Logger } from '../infrastructure/logger/ConsoleLogger';
