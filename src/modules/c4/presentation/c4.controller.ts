import { readJsonBody } from '../../../shared/http/body';
import { HttpStatus } from '../../../shared/http/enums/http.enums';
import type { RouteContext } from '../../../shared/http/interfaces/router.interface';
import { NdjsonStream } from '../../../shared/http/ndjson';
import { sendJson } from '../../../shared/http/response';
import type { C4SketchService } from '../application/c4Sketch.service';
import { MAX_C4_BODY_BYTES } from './constants/c4.constants';
import { DEFAULT_MAX_CHAT_IMAGES } from '../../chat/presentation/constants/chat.constants';
import type { StagedImageService } from '../../chat/application/stagedImages.service';
import { C4StreamEvent } from './enums/c4.enums';
import { toStreamSink } from './helpers/c4Stream.helper';
import { toC4ResumeRequest, toC4SketchDto, toC4SketchRequest } from './mappers/c4.mapper';

/** HTTP adapter for the C4 sketcher: parse the request, call C4SketchService, answer as JSON or as an NDJSON stream. */
export class C4Controller {
  constructor(
    private readonly sketcher: C4SketchService,
    /** Upload-first images (`imageIds` from POST /api/chat/images); absent = only base64 `images`. */
    private readonly uploads: StagedImageService | null = null,
  ) {}

  sketch = async ({ req, res }: RouteContext): Promise<void> => {
    this.sketcher.ensureEnabled();
    const raw = await readJsonBody(req, MAX_C4_BODY_BYTES);
    const { body, imageIds } = this.uploads ? await this.uploads.expandBody(raw, DEFAULT_MAX_CHAT_IMAGES) : { body: raw, imageIds: [] as string[] };
    const request = toC4SketchRequest(body);
    if (!request.stream) {
      const result = await this.sketcher.sketch(request);
      if (imageIds.length) this.uploads?.consume(imageIds);
      return sendJson(res, HttpStatus.OK, toC4SketchDto(result));
    }
    const out = new NdjsonStream(res);
    const result = await this.sketcher.sketch(request, toStreamSink(out));
    if (imageIds.length) this.uploads?.consume(imageIds);
    out.end({ type: C4StreamEvent.DONE, ...toC4SketchDto(result) });
  };

  resume = async ({ req, res }: RouteContext): Promise<void> => {
    this.sketcher.ensureEnabled();
    const request = toC4ResumeRequest(await readJsonBody(req, MAX_C4_BODY_BYTES));
    if (!request.stream) return sendJson(res, HttpStatus.OK, toC4SketchDto(await this.sketcher.resume(request)));
    const out = new NdjsonStream(res);
    out.end({ type: C4StreamEvent.DONE, ...toC4SketchDto(await this.sketcher.resume(request, toStreamSink(out))) });
  };
}
