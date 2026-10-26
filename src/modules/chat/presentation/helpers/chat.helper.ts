import { ValidationError } from '../../../../shared/errors';
import { ConversationRole, normalizeHistory, type ConversationTurn, type PromptImage } from '../../../ai';
import { DATA_URL, IMAGE_MIME_PREFIX, MAX_CHAT_IMAGES, MAX_RAW_HISTORY_TURNS } from '../constants/chat.constants';
import { RawHistoryTurn, RawImage } from '../dto/chat.dto';

export function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function parseImages(rawImages: unknown): PromptImage[] {
  const list = rawImages ?? [];
  if (!Array.isArray(list)) throw new ValidationError('images must be an array');
  if (list.length > MAX_CHAT_IMAGES) throw new ValidationError(`At most ${MAX_CHAT_IMAGES} images per question`);
  return (list as RawImage[]).map((image, i) => {
    const decoded = decodeImage(image);
    if (!decoded) throw new ValidationError(`images[${i}] must be { mimeType: "image/*", data: <base64 or data URL> }`);
    return decoded;
  });
}

export function decodeImage(image: RawImage): PromptImage | null {
  if (!image || typeof image !== 'object' || typeof image.data !== 'string') return null;
  let mimeType = typeof image.mimeType === 'string' ? image.mimeType : '';
  let base64 = image.data;
  const dataUrl = DATA_URL.exec(base64);
  if (dataUrl) {
    mimeType ||= dataUrl[1];
    base64 = dataUrl[2];
  }
  if (!mimeType.startsWith(IMAGE_MIME_PREFIX)) return null;
  const data = Buffer.from(base64, 'base64');
  return data.length > 0 ? { data, mimeType } : null;
}

/** Earlier turns of the client's conversation, oldest first; trimmed to the server's limits by `normalizeHistory`. */
export function parseHistory(rawHistory: unknown): ConversationTurn[] {
  const list = rawHistory ?? [];
  if (!Array.isArray(list)) throw new ValidationError('history must be an array');
  if (list.length > MAX_RAW_HISTORY_TURNS) throw new ValidationError(`At most ${MAX_RAW_HISTORY_TURNS} history turns per question`);
  const turns = (list as RawHistoryTurn[]).map((turn, i) => {
    const role = turn?.role === ConversationRole.USER || turn?.role === ConversationRole.ASSISTANT ? turn.role : null;
    if (!role || typeof turn.text !== 'string') throw new ValidationError(`history[${i}] must be { role: "user" | "assistant", text: string }`);
    return { role, text: turn.text };
  });
  return normalizeHistory(turns);
}
