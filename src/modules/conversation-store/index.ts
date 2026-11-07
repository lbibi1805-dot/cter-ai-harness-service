import { getNeonSql, usesNeon } from '../../shared/database/helpers/database.helper';
import type { DatabaseSettings } from '../../shared/database/interfaces/database.interface';
import { neonSqlClient } from '../../shared/database/neonSqlClient';
import { Router } from '../../shared/http/router';
import { logger } from '../../shared/logging/logger';
import type { ObjectStorage } from '../../shared/storage';
import { ConversationService } from './application/conversation.service';
import type { ConversationStore } from './domain';
import { InMemoryConversationStore } from './infrastructure/inMemoryConversationStore.repository';
import { NeonConversationStore } from './infrastructure/neonConversationStore.repository';
import { ConversationController } from './presentation/conversation.controller';
import { createConversationRoutes } from './presentation/conversation.routes';

export interface ConversationStoreConfig {
  /** CONVERSATION_STORE_ENABLED (feature flag, default off): off = the old stateless chat (client sends history). */
  enabled: boolean;
  purgeDays: number;
  database: DatabaseSettings;
  chatApiToken?: string;
  adminToken?: string;
}

export interface ConversationStoreDeps {
  storage: ObjectStorage;
  /** Test hook. */
  store?: ConversationStore;
  now?: () => number;
}

export interface ConversationStoreModule {
  /** Null when disabled. */
  service: ConversationService | null;
  store: ConversationStore | null;
  router: Router;
}

/** Server-side conversations: Neon rows + object storage files, `/api/conversations` API. */
export function createConversationStoreModule(config: ConversationStoreConfig, deps: ConversationStoreDeps): ConversationStoreModule {
  const enabled = config.enabled && !!config.chatApiToken;
  let store: ConversationStore | null = null;
  let service: ConversationService | null = null;
  if (enabled) {
    store = deps.store ?? createConversationStore(config.database);
    service = new ConversationService(store, deps.storage, { purgeDays: config.purgeDays, ...(deps.now ? { now: deps.now } : {}) });
  } else if (config.enabled) {
    logger.info('[conversations] CHAT_API_TOKEN not set — conversation store disabled');
  }
  const controller = new ConversationController(service, config.chatApiToken, config.adminToken);
  return { service, store, router: new Router(createConversationRoutes(controller), [config.chatApiToken, config.adminToken]) };
}

export function createConversationStore(database: DatabaseSettings): ConversationStore {
  if (usesNeon(database)) return new NeonConversationStore(neonSqlClient(getNeonSql(database.databaseUrl)));
  logger.info('[conversations] Neon not configured (VAULT_STORAGE_PROVIDER + DATABASE_URL) — conversations kept in memory (lost on restart)');
  return new InMemoryConversationStore();
}

export * from './domain';
export { ConversationService } from './application/conversation.service';
export { DEFAULT_CONVERSATION_PURGE_DAYS } from './application/constants/conversationService.constants';
export type { ConversationView, ArtifactView, StoredObjectRef } from './application/interfaces/conversationService.interface';
export { InMemoryConversationStore } from './infrastructure/inMemoryConversationStore.repository';
export { NeonConversationStore } from './infrastructure/neonConversationStore.repository';
export { ConversationApiPath } from './presentation/enums/conversation.enums';
