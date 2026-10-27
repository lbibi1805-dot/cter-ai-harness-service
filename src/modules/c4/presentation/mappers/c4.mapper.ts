import { ValidationError } from '../../../../shared/errors';
import { AI_PROVIDERS, parseAIProvider } from '../../../ai';
import { C4_LEVEL_ORDER, parseC4Level, type C4Level } from '../../domain';
import type { C4SketchRequest, C4SketchResult } from '../../application/interfaces/c4Sketch.interface';
import { MAX_DESCRIPTION_CHARS } from '../constants/c4.constants';
import type { C4SketchDto } from '../dto/c4.dto';

/** Shape validation of a `POST /api/c4` body; model rules are checked by C4SketchService. */
export function toC4SketchRequest(body: unknown): C4SketchRequest {
  if (!body || typeof body !== 'object') throw new ValidationError('Body must be a JSON object');
  const raw = body as Record<string, unknown>;

  const rawProvider = typeof raw.provider === 'string' ? raw.provider.trim().toLowerCase() : '';
  if (!rawProvider) throw new ValidationError('Missing provider');
  const provider = parseAIProvider(rawProvider);
  if (!provider) throw new ValidationError(`Provider "${rawProvider}" is not servable (supported: ${AI_PROVIDERS.join(', ')})`);

  const description = typeof raw.description === 'string' ? raw.description.trim() : '';
  if (!description) throw new ValidationError('Missing description (the problem statement)');
  if (description.length > MAX_DESCRIPTION_CHARS) throw new ValidationError(`description is longer than ${MAX_DESCRIPTION_CHARS} characters`);

  const rawLevels = raw.levels ?? [];
  if (!Array.isArray(rawLevels)) throw new ValidationError('levels must be an array');
  const levels = rawLevels.map((value, i) => {
    const level = parseC4Level(value);
    if (!level) throw new ValidationError(`levels[${i}] must be one of ${C4_LEVEL_ORDER.join(', ')}`);
    return level;
  });

  const model = typeof raw.model === 'string' && raw.model.trim() ? raw.model.trim() : undefined;
  return { provider, requestedModel: model, description, levels: [...new Set<C4Level>(levels)], fast: raw.fast === true };
}

export function toC4SketchDto(result: C4SketchResult): C4SketchDto {
  return {
    provider: result.provider,
    model: result.model,
    systemName: result.systemName,
    requirements: result.requirements,
    knowledgeSources: result.knowledgeSources,
    levels: result.levels.map((level) => ({
      level: level.level,
      ok: !!level.png,
      title: level.title ?? null,
      png: level.png ? level.png.toString('base64') : null,
      puml: level.puml ?? null,
      elementCount: level.elementCount,
      covered: level.covered,
      missing: level.missing,
      notes: level.notes,
      error: level.error ?? null,
    })),
    durationMs: result.elapsedMs,
    deadlineHit: result.deadlineHit,
  };
}
