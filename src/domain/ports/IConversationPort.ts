import type { ConversationAttachment, ConversationMessage } from '../../types';

export interface ConversationSettingsRead {
  activeConversationId: number | null;
  sawSystemPrompt: boolean;
}

export interface IConversationPort {
  getSelfUserId(): Promise<number>;
  listMessages(conversationId: number): Promise<ConversationMessage[]>;
  listSettingsConversations(marker: string): Promise<{ id: number; subject: string }[]>;
  readSettings(settingsConversationId: number): Promise<ConversationSettingsRead>;
  addReply(conversationId: number, body: string): Promise<void>;
  downloadAttachment(fileUrl: string): Promise<Buffer>;
}
