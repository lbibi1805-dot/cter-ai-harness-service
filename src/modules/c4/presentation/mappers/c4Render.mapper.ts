import { ValidationError } from '../../../../shared/errors';
import { PayloadTooLargeError } from '../../../../shared/http/errors/body.errors';
import { MAX_RENDER_SOURCE_CHARS } from '../../application/constants/c4Render.constants';
import { C4_RENDER_FORMAT_PNG } from '../constants/c4.constants';

export interface C4RenderRequest {
  source: string;
  format: typeof C4_RENDER_FORMAT_PNG;
}

/** Shape validation of a `POST /api/c4/render` body: `{ source, format?: "png" }`. */
export function toC4RenderRequest(body: unknown): C4RenderRequest {
  if (!body || typeof body !== 'object') throw new ValidationError('Body must be a JSON object');
  const raw = body as Record<string, unknown>;
  if (typeof raw.source !== 'string' || !raw.source.trim()) throw new ValidationError('Missing source (PlantUML text)');
  if (raw.source.length > MAX_RENDER_SOURCE_CHARS) throw new PayloadTooLargeError(MAX_RENDER_SOURCE_CHARS);
  if (raw.format !== undefined && raw.format !== C4_RENDER_FORMAT_PNG) throw new ValidationError('format must be "png"');
  return { source: raw.source, format: C4_RENDER_FORMAT_PNG };
}
