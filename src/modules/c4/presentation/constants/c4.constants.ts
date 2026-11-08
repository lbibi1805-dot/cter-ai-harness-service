import { MAX_RENDER_SOURCE_CHARS } from '../../application/constants/c4Render.constants';
import { BYTES_PER_MB, DEFAULT_CHAT_MAX_BODY_MB, DEFAULT_GEMINI_INLINE_IMAGES_MAX_MB } from '../../../chat/presentation/constants/chat.constants';

/** Problem pages / the user's design come as base64 images: same budget as /api/chat. */
export const MAX_C4_BODY_BYTES = DEFAULT_CHAT_MAX_BODY_MB * BYTES_PER_MB;

/** Gemini takes images inline only (same limit as /api/chat). */
export const C4_GEMINI_INLINE_IMAGES_MAX_BYTES = DEFAULT_GEMINI_INLINE_IMAGES_MAX_MB * BYTES_PER_MB;

/** Long enough for a full exam question, short enough to keep the architect prompt small. */
export const MAX_DESCRIPTION_CHARS = 12_000;

/** `POST /api/c4/render` body: the source (≤ 4 bytes per char in UTF-8 JSON) plus room for the other fields. */
export const MAX_C4_RENDER_BODY_BYTES = MAX_RENDER_SOURCE_CHARS * 4 + 1024;

/** The only `format` the preview endpoint renders. */
export const C4_RENDER_FORMAT_PNG = 'png';

/** Clients may keep a preview: the same source always renders the same image. */
export const C4_RENDER_CACHE_CONTROL = 'private, max-age=86400';

/** Response header telling whether the preview came from the RAM cache (`hit`) or the PlantUML server (`miss`). */
export const C4_RENDER_CACHE_HEADER = 'X-Render-Cache';
