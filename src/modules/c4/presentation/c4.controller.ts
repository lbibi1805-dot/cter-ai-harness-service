import { readJsonBody } from '../../../shared/http/body';
import { HttpStatus } from '../../../shared/http/enums/http.enums';
import type { RouteContext } from '../../../shared/http/interfaces/router.interface';
import { NdjsonStream } from '../../../shared/http/ndjson';
import { sendJson } from '../../../shared/http/response';
import type { C4SketchService } from '../application/c4Sketch.service';
import { MAX_C4_BODY_BYTES } from './constants/c4.constants';
import { C4StreamEvent } from './enums/c4.enums';
import { toStreamSink } from './helpers/c4Stream.helper';
import { toC4ResumeRequest, toC4SketchDto, toC4SketchRequest } from './mappers/c4.mapper';

/** HTTP adapter for the C4 sketcher: parse the request, call C4SketchService, answer as JSON or as an NDJSON stream. */
export class C4Controller {
  constructor(private readonly sketcher: C4SketchService) {}

  sketch = async ({ req, res }: RouteContext): Promise<void> => {
    this.sketcher.ensureEnabled();
    const request = toC4SketchRequest(await readJsonBody(req, MAX_C4_BODY_BYTES));
    if (!request.stream) return sendJson(res, HttpStatus.OK, toC4SketchDto(await this.sketcher.sketch(request)));
    const out = new NdjsonStream(res);
    out.end({ type: C4StreamEvent.DONE, ...toC4SketchDto(await this.sketcher.sketch(request, toStreamSink(out))) });
  };

  resume = async ({ req, res }: RouteContext): Promise<void> => {
    this.sketcher.ensureEnabled();
    const request = toC4ResumeRequest(await readJsonBody(req, MAX_C4_BODY_BYTES));
    if (!request.stream) return sendJson(res, HttpStatus.OK, toC4SketchDto(await this.sketcher.resume(request)));
    const out = new NdjsonStream(res);
    out.end({ type: C4StreamEvent.DONE, ...toC4SketchDto(await this.sketcher.resume(request, toStreamSink(out))) });
  };
}
