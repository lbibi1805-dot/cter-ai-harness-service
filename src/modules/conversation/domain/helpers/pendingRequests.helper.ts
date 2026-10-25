import { ConversationMessage } from '../interfaces/conversationMessage.interface';

export function byCreatedAtAsc(a: ConversationMessage, b: ConversationMessage): number {
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}
