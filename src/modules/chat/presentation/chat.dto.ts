import { resolveModel } from '../../../ai/aiRouter';
import { ALLOWED_MODELS, isValidModel } from '../../../config/allowedModels';
import type { AIProviderName, AppConfig, FileContent } from '../../../types';
import { AnswerMode } from '../../agent/domain';

/** Base64 screenshots are ~1.4x the PNG size; 20 MB fits a few full-HD captures. */
export const MAX_CHAT_BODY_BYTES = 20 * 1024 * 1024;
export const MAX_CHAT_IMAGES = 4;

export interface ChatQuestion {
  provider: AIProviderName;
  model: string;
  mode: AnswerMode;
  content: FileContent;
}

export type ChatQuestionParse = { ok: true; value: ChatQuestion } | { ok: false; error: string };

interface RawImage {
  mimeType?: unknown;
  data?: unknown;
}

const DATA_URL = /^data:([^;,]+);base64,([\s\S]*)$/;

/**
 * Validates a `POST /api/chat` body with the same rules the Canvas chat applies
 * to a [CFH:REQUEST] (servable provider, allowed model, `mode: agent` opt-in).
 */
export function toChatQuestion(body: unknown, defaultModels: AppConfig['defaultModels']): ChatQuestionParse {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Body must be a JSON object' };
  const raw = body as Record<string, unknown>;

  const provider = typeof raw.provider === 'string' ? raw.provider.trim().toLowerCase() : '';
  if (!provider) return { ok: false, error: 'Missing provider' };
  if (!(provider in ALLOWED_MODELS)) {
    return { ok: false, error: `Provider "${provider}" is not servable (supported: ${Object.keys(ALLOWED_MODELS).join(', ')})` };
  }
  const servable = provider as AIProviderName;

  const requestedModel = typeof raw.model === 'string' && raw.model.trim() ? raw.model.trim() : undefined;
  const model = resolveModel(servable, requestedModel, defaultModels);
  if (requestedModel !== undefined && !isValidModel(servable, model)) {
    return { ok: false, error: `Model "${model}" is not supported for provider ${servable}. Allowed: ${ALLOWED_MODELS[servable].join(', ')}` };
  }

  const mode = typeof raw.mode === 'string' && raw.mode.toLowerCase() === AnswerMode.AGENT ? AnswerMode.AGENT : AnswerMode.SINGLE_SHOT;

  const rawImages = raw.images ?? [];
  if (!Array.isArray(rawImages)) return { ok: false, error: 'images must be an array' };
  if (rawImages.length > MAX_CHAT_IMAGES) return { ok: false, error: `At most ${MAX_CHAT_IMAGES} images per question` };
  const imageBuffers: FileContent['imageBuffers'] = [];
  for (const [i, image] of (rawImages as RawImage[]).entries()) {
    const decoded = decodeImage(image);
    if (!decoded) return { ok: false, error: `images[${i}] must be { mimeType: "image/*", data: <base64 or data URL> }` };
    imageBuffers.push(decoded);
  }

  const question = typeof raw.question === 'string' ? raw.question.trim() : '';
  if (!question && imageBuffers.length === 0) return { ok: false, error: 'Provide a question or at least one image' };

  return { ok: true, value: { provider: servable, model, mode, content: { textContent: question, imageBuffers } } };
}

function decodeImage(image: RawImage): FileContent['imageBuffers'][number] | null {
  if (!image || typeof image !== 'object' || typeof image.data !== 'string') return null;
  let mimeType = typeof image.mimeType === 'string' ? image.mimeType : '';
  let base64 = image.data;
  const dataUrl = DATA_URL.exec(base64);
  if (dataUrl) {
    mimeType ||= dataUrl[1];
    base64 = dataUrl[2];
  }
  if (!mimeType.startsWith('image/')) return null;
  const data = Buffer.from(base64, 'base64');
  return data.length > 0 ? { data, mimeType } : null;
}
