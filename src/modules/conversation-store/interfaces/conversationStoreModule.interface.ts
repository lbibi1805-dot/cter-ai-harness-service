import type { DatabaseSettings } from '../../../shared/database/interfaces/database.interface';
import type { Router } from '../../../shared/http/router';
import type { ObjectStorage } from '../../../shared/storage';
import type { ConversationService } from '../application/conversation.service';
import type { ConversationStore } from '../domain';

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
