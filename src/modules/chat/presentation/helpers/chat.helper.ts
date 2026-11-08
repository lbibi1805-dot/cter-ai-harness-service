import { ValidationError } from '../../../../shared/errors';
import { ConversationRole, normalizeHistory, type ConversationTurn, type PromptImage } from '../../../ai';
import { DATA_URL, DEFAULT_MAX_CHAT_IMAGES, IMAGE_MIME_PREFIX, MAX_RAW_HISTORY_TURNS, MAX_REF_ARTIFACT_IDS, REF_ARTIFACT_ALIAS, REF_ARTIFACT_UUID } from '../constants/chat.constants';
import { RawHistoryTurn, RawImage } from '../dto/chat.dto';
import { ImagesTooLargeError } from '../errors/chat.errors';
import type { RawUpload } from '../../application/interfaces/stagedImages.interface';

export function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/** `maxImages` defaults to DEFAULT_MAX_CHAT_IMAGES for callers without configured limits (e.g. /api/c4). */
export function parseImages(rawImages: unknown, maxImages: number = DEFAULT_MAX_CHAT_IMAGES): PromptImage[] {
  const list = rawImages ?? [];
  if (!Array.isArray(list)) throw new ValidationError('images must be an array');
  if (list.length > maxImages) throw new ValidationError(`At most ${maxImages} images per question (got ${list.length})`);
  return (list as RawImage[]).map((image, i) => {
    const decoded = decodeImage(image);
    if (!decoded) throw new ValidationError(`images[${i}] must be { mimeType: "image/*", data: <base64 or data URL> }`);
    return decoded;
  });
}

/** Throws ImagesTooLargeError (413) when the decoded images exceed what the provider takes inline. */
export function assertInlineImageBudget(images: PromptImage[], limitBytes: number, provider: string): void {
  const total = images.reduce((sum, image) => sum + image.data.length, 0);
  if (total > limitBytes) throw new ImagesTooLargeError(total, limitBytes, provider);
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

/** `refArtifactIds`: artifact aliases (`A7`, uppercased) or UUIDs the user referenced; deduped, order kept. */
export function parseRefArtifactIds(raw: unknown): string[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw new ValidationError('refArtifactIds must be an array of artifact ids like "A7"');
  if (raw.length > MAX_REF_ARTIFACT_IDS) throw new ValidationError(`At most ${MAX_REF_ARTIFACT_IDS} refArtifactIds per question`);
  const ids = raw.map((value, i) => {
    const id = typeof value === 'string' ? value.trim() : '';
    if (REF_ARTIFACT_ALIAS.test(id)) return id.toUpperCase();
    if (REF_ARTIFACT_UUID.test(id)) return id.toLowerCase();
    throw new ValidationError(`refArtifactIds[${i}] must be an artifact id like "A7"`);
  });
  return [...new Set(ids)];
}

/**
 * `POST /api/chat/images` JSON body: `{ images: [{ data: <base64 or data URL>, mimeType? }] }`. The declared type
 * is optional: the service checks the magic bytes anyway.
 */
export function parseUploadBody(body: unknown, maxImages: number): RawUpload[] {
  const list = body && typeof body === 'object' ? (body as Record<string, unknown>).images : undefined;
  if (!Array.isArray(list) || list.length === 0) throw new ValidationError('Body must be { images: [{ data: <base64>, mimeType }] } or one raw image with Content-Type: image/*');
  if (list.length > maxImages) throw new ValidationError(`At most ${maxImages} images per upload (got ${list.length})`);
  return (list as RawImage[]).map((image, i) => {
    const raw = image && typeof image === 'object' && typeof image.data === 'string' ? image.data : '';
    const dataUrl = DATA_URL.exec(raw);
    const data = Buffer.from(dataUrl ? dataUrl[2] : raw, 'base64');
    if (data.length === 0) throw new ValidationError(`images[${i}] must be { data: <base64 or data URL>, mimeType: "image/*" }`);
    const declared = typeof image.mimeType === 'string' ? image.mimeType : dataUrl?.[1];
    return { data, ...(declared ? { mimeType: declared } : {}) };
  });
}
