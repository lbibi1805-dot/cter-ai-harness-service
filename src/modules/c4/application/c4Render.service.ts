import { ServiceDisabledError, UpstreamError, ValidationError, errorMessage } from '../../../shared/errors';
import { logger } from '../../../shared/logging/logger';
import { normalizePlantUmlSource } from '../../../shared/text';
import type { DiagramRender, DiagramRenderer } from '../domain';
import { RENDER_CACHE_MAX_BYTES, RENDER_CACHE_MAX_ENTRIES } from './constants/c4Render.constants';
import { RenderCache, renderCacheKey } from './helpers/renderCache.helper';

export interface C4RenderResult extends DiagramRender {
  cached: boolean;
}

/**
 * Preview of a PlantUML block from a chat answer (`POST /api/c4/render`): normalize, then
 * the RAM cache, then the PlantUML server. Touches no database or object storage.
 * Syntax errors are cached too (same source → same error); renderer failures are not.
 */
export class C4RenderService {
  private readonly cache: RenderCache;

  constructor(
    private readonly enabled: boolean,
    private readonly renderer: DiagramRenderer,
    cache?: RenderCache,
  ) {
    this.cache = cache ?? new RenderCache(RENDER_CACHE_MAX_ENTRIES, RENDER_CACHE_MAX_BYTES);
  }

  ensureEnabled(): void {
    if (!this.enabled) throw new ServiceDisabledError('C4 API disabled: set CHAT_API_TOKEN on the server');
  }

  async render(source: string): Promise<C4RenderResult> {
    this.ensureEnabled();
    const normalized = normalizePlantUmlSource(source);
    if (!normalized.replace(/@startuml|@enduml/g, '').trim()) throw new ValidationError('source is empty');
    const key = renderCacheKey(normalized);
    const hit = this.cache.get(key);
    if (hit) return { ...hit, cached: true };

    let result: DiagramRender;
    try {
      result = await this.renderer.render(normalized);
    } catch (err) {
      logger.warn(`[c4-render] PlantUML render failed: ${errorMessage(err)}`);
      throw err instanceof UpstreamError ? err : new UpstreamError(`PlantUML renderer failed: ${errorMessage(err)}`, undefined, { cause: err });
    }
    if (!result.png && !result.syntaxError) throw new UpstreamError('PlantUML renderer returned no image');
    this.cache.set(key, result);
    return { ...result, cached: false };
  }
}
