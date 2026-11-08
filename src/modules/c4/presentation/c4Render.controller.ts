import { readJsonBody } from '../../../shared/http/body';
import { ContentType, HttpHeader, HttpStatus } from '../../../shared/http/enums/http.enums';
import type { RouteContext } from '../../../shared/http/interfaces/router.interface';
import { sendJson } from '../../../shared/http/response';
import type { C4RenderService } from '../application/c4Render.service';
import { C4_RENDER_CACHE_CONTROL, C4_RENDER_CACHE_HEADER, MAX_C4_RENDER_BODY_BYTES } from './constants/c4.constants';
import { toC4RenderRequest } from './mappers/c4Render.mapper';

/**
 * `POST /api/c4/render`: PlantUML source → `200 image/png`, or `422 { error, syntaxError, line }`
 * when PlantUML reports a syntax error (renderer failures → 502 through the router).
 */
export class C4RenderController {
  constructor(private readonly renderer: C4RenderService) {}

  render = async ({ req, res }: RouteContext): Promise<void> => {
    this.renderer.ensureEnabled();
    const request = toC4RenderRequest(await readJsonBody(req, MAX_C4_RENDER_BODY_BYTES));
    const result = await this.renderer.render(request.source);
    if (result.syntaxError || !result.png) {
      return sendJson(res, HttpStatus.UNPROCESSABLE_ENTITY, {
        error: 'PlantUML syntax error',
        syntaxError: result.syntaxError ?? 'PlantUML rejected the source',
        line: result.errorLine ?? null,
      });
    }
    res.writeHead(HttpStatus.OK, {
      [HttpHeader.CONTENT_TYPE]: ContentType.PNG,
      [HttpHeader.CACHE_CONTROL]: C4_RENDER_CACHE_CONTROL,
      [C4_RENDER_CACHE_HEADER]: result.cached ? 'hit' : 'miss',
      'Content-Length': String(result.png.length),
    });
    res.end(result.png);
  };
}
