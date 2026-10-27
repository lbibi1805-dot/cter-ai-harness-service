import { readJsonBody } from '../../../shared/http/body';
import { HttpStatus } from '../../../shared/http/enums/http.enums';
import type { RouteContext } from '../../../shared/http/interfaces/router.interface';
import { sendJson } from '../../../shared/http/response';
import type { C4SketchService } from '../application/c4Sketch.service';
import { MAX_C4_BODY_BYTES } from './constants/c4.constants';
import { toC4SketchDto, toC4SketchRequest } from './mappers/c4.mapper';

/** HTTP adapter for the C4 sketcher: parse the request, call C4SketchService, shape the JSON. */
export class C4Controller {
  constructor(private readonly sketcher: C4SketchService) {}

  sketch = async ({ req, res }: RouteContext): Promise<void> => {
    this.sketcher.ensureEnabled();
    const request = toC4SketchRequest(await readJsonBody(req, MAX_C4_BODY_BYTES));
    sendJson(res, HttpStatus.OK, toC4SketchDto(await this.sketcher.sketch(request)));
  };
}
