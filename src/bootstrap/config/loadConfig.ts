import 'dotenv/config';
import { DEFAULT_CANVAS_FOLDERS } from '../../modules/fileqa/domain';
import { DEFAULT_HEARTBEAT_INTERVAL_MS } from '../../modules/ops';
import { DEFAULT_POLL_CURSOR_FLUSH_MS } from '../../modules/polling';
import { readBoolean, readInt, readList, readOptionalString, readString } from '../../shared/config/env';
import { DEFAULT_POLL_INTERVAL_MS, DEFAULT_API_PORT } from '../constants/bootstrap.constants';
import type { AppConfig } from '../interfaces/appConfig.interface';
import { readChatConfig } from './readers/chatConfig.reader';
import { readPromptConfig } from './readers/promptConfig.reader';
import { readAiConfig } from './readers/aiConfig.reader';
import { readC4Config } from './readers/c4Config.reader';
import { readCanvasAccounts } from './readers/canvasAccounts.reader';
import { readRerankConfig } from './readers/rerankConfig.reader';
import { readRetrievalConfig } from './readers/retrievalConfig.reader';
import { readStorageConfig } from './readers/storageConfig.reader';
import { readCaptureConfig } from './readers/captureConfig.reader';
import { readContextConfig } from './readers/contextConfig.reader';
import { readEssayConfig } from './readers/essayConfig.reader';
import { DEFAULT_AGENT_BUDGET } from '../../modules/agent/domain/constants/agentBudget.constants';
import { DEFAULT_AGENT_MAX_DIAGRAM_VALIDATIONS, DEFAULT_DIAGRAM_GUARD_ENABLED, DEFAULT_DIAGRAM_MAX_REPAIRS } from '../../modules/agent/application/constants/diagramGuard.constants';
import { parseStorageProvider } from '../../shared/database/helpers/database.helper';

/** Reads `.env` + system-prompt.md + knowledge.md once at startup. Bad values fail fast. */
export function loadConfig(): AppConfig {
  const storage = readStorageConfig();
  return {
    http: {
      port: readInt('API_PORT', DEFAULT_API_PORT),
      adminToken: readOptionalString('ADMIN_TOKEN'),
      chatApiToken: readOptionalString('CHAT_API_TOKEN'),
      corsOrigins: readList('FRONTEND_URL', readList('ALLOWED_ORIGINS', [])),
    },
    accounts: readCanvasAccounts(),
    canvasFolders: {
      materials: readString('CANVAS_MATERIALS_FOLDER', DEFAULT_CANVAS_FOLDERS.materials),
      input: readString('CANVAS_INPUT_FOLDER', DEFAULT_CANVAS_FOLDERS.input),
      output: readString('CANVAS_OUTPUT_FOLDER', DEFAULT_CANVAS_FOLDERS.output),
    },
    polling: {
      intervalMs: readInt('POLL_INTERVAL_MS', DEFAULT_POLL_INTERVAL_MS),
      autostart: readBoolean('POLL_AUTOSTART', true),
      cursorFlushMs: readInt('POLL_CURSOR_FLUSH_MS', DEFAULT_POLL_CURSOR_FLUSH_MS),
    },
    prompts: readPromptConfig(),
    chat: readChatConfig(),
    ai: readAiConfig(),
    retrieval: readRetrievalConfig(),
    rerank: readRerankConfig(),
    agent: {
      maxToolCalls: readInt('AGENT_MAX_TOOL_CALLS', DEFAULT_AGENT_BUDGET.maxToolCalls),
      minToolCalls: readInt('AGENT_MIN_TOOL_CALLS', DEFAULT_AGENT_BUDGET.minToolCalls),
      maxDurationMs: readInt('AGENT_MAX_DURATION_MS', DEFAULT_AGENT_BUDGET.maxDurationMs),
      maxDiagramValidations: readInt('AGENT_MAX_DIAGRAM_VALIDATIONS', DEFAULT_AGENT_MAX_DIAGRAM_VALIDATIONS),
    },
    diagramGuard: {
      enabled: readBoolean('DIAGRAM_SYNTAX_GUARD_ENABLED', DEFAULT_DIAGRAM_GUARD_ENABLED),
      maxRepairs: readInt('DIAGRAM_SYNTAX_MAX_REPAIRS', DEFAULT_DIAGRAM_MAX_REPAIRS),
    },
    c4: readC4Config(),
    database: {
      provider: parseStorageProvider(readOptionalString('VAULT_STORAGE_PROVIDER')),
      databaseUrl: readOptionalString('DATABASE_URL'),
    },
    storage,
    capture: readCaptureConfig(storage),
    context: readContextConfig(),
    essay: readEssayConfig(),
    gmail: { user: readOptionalString('GMAIL_USER'), appPassword: readOptionalString('GMAIL_APP_PASSWORD') },
    heartbeat: {
      enabled: readBoolean('CRON_ENABLED', true),
      intervalMs: readInt('CRON_INTERVAL_MS', DEFAULT_HEARTBEAT_INTERVAL_MS),
    },
  };
}
