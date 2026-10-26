import { ConversationMessage } from './conversationMessage.interface';
import { ConversationSettings } from './pendingRequests.interface';

export interface SettingsConversationRef {
  id: number;
  subject: string;
}

/** The slice of the Canvas Conversations API the poller needs (one instance per account). */
export interface ConversationGateway {
  /** All messages, oldest first. */
  listMessages(conversationId: number): Promise<ConversationMessage[]>;
  /** The user's own conversations whose subject contains `marker`, newest first. */
  listSettingsConversations(marker: string): Promise<SettingsConversationRef[]>;
  readSettings(settingsConversationId: number): Promise<ConversationSettings>;
  /** Posts a text-only [CFH:REPLY]. */
  addReply(conversationId: number, body: string): Promise<void>;
  downloadAttachment(fileUrl: string): Promise<Buffer>;
}
