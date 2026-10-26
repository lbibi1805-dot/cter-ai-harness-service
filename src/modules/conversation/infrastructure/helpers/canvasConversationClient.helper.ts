import { DEFAULT_ATTACHMENT_NAME } from '../../domain/constants/conversation.constants';
import { ConversationAttachment, ConversationMessage } from '../../domain/interfaces/conversationMessage.interface';
import { RawMessage } from '../interfaces/canvasConversationClient.interface';

export function toConversationMessage(raw: RawMessage): ConversationMessage {
  return {
    id: raw.id,
    body: raw.body ?? '',
    createdAt: raw.created_at ?? '',
    attachments: (raw.attachments ?? [])
      .map((attachment): ConversationAttachment => ({
        id: String(attachment.id ?? ''),
        filename: attachment.filename ?? DEFAULT_ATTACHMENT_NAME,
        url: attachment.url ?? '',
        contentType: attachment['content-type'] ?? attachment.contentType,
      }))
      .filter((attachment) => attachment.id && attachment.url),
  };
}
