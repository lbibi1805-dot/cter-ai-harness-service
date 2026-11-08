import { ServiceDisabledError } from '../../../shared/errors';
import { readJsonBody, readRawBody } from '../../../shared/http/body';
import { HttpStatus } from '../../../shared/http/enums/http.enums';
import { sendJson } from '../../../shared/http/response';
import type { ChatService } from '../application/chat.service';
import type { StagedImageService } from '../application/stagedImages.service';
import { parseImageIds } from '../application/helpers/imageIds.helper';
import { toChatAnswerDto, toChatQuestion } from './mappers/chat.mapper';
import { RouteContext } from '../../../shared/http/interfaces/router.interface';
import { DEFAULT_CHAT_LIMITS, IMAGE_MIME_PREFIX } from './constants/chat.constants';
import type { ChatLimits } from './interfaces/chatLimits.interface';
import { ChatStreamEvent, ChatProgressStage } from './enums/chat.enums';
import { NdjsonStream } from '../../../shared/http/ndjson';
import { parseUploadBody } from './helpers/chat.helper';

/** HTTP adapter for the chat API: parse the request, call ChatService, shape the JSON. */
export class ChatController {
  constructor(
    private readonly chat: ChatService,
    private readonly limits: ChatLimits = DEFAULT_CHAT_LIMITS,
    /** Upload-first images (object storage); absent = `imageIds` and `/api/chat/images` answer 503. */
    private readonly uploads: StagedImageService | null = null,
  ) {}

  status = async ({ res }: RouteContext): Promise<void> => {
    sendJson(res, HttpStatus.OK, { ok: true, ...this.chat.status() });
  };

  /** `POST /api/chat/images`: one raw `image/*` body, or JSON `{ images: [{ data, mimeType }] }` → `{ images: [{ imageId, … }] }`. */
  uploadImages = async ({ req, res }: RouteContext): Promise<void> => {
    this.chat.ensureEnabled();
    const uploads = this.requireUploads();
    const contentType = String(req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
    const raws = contentType.startsWith(IMAGE_MIME_PREFIX)
      ? [{ data: await readRawBody(req, this.limits.maxBodyBytes), mimeType: contentType }]
      : parseUploadBody(await readJsonBody(req, this.limits.maxBodyBytes), this.limits.maxImages);
    sendJson(res, HttpStatus.OK, { images: await uploads.stage(raws) });
  };

  ask = async ({ req, res }: RouteContext): Promise<void> => {
    this.chat.ensureEnabled();
    const body = await readJsonBody(req, this.limits.maxBodyBytes);
    const imageIds = parseImageIds(body && typeof body === 'object' ? (body as Record<string, unknown>).imageIds : undefined, this.limits.maxImages);
    const staged = imageIds.length > 0 ? await this.requireUploads().resolve(imageIds) : [];
    const question = toChatQuestion(body, this.limits, staged);
    if (!question.stream) {
      const answer = await this.chat.ask(question);
      this.consume(imageIds);
      return sendJson(res, HttpStatus.OK, toChatAnswerDto(answer));
    }

    // The status line goes out with the first event, so errors before any text still get their HTTP status.
    const out = new NdjsonStream(res);
    // Sent before the prompt is built (RAG can take seconds), so the client can show what is happening.
    out.write({ type: ChatStreamEvent.PROGRESS, stage: ChatProgressStage.PREPARING });
    const answer = await this.chat.ask(question, {
      delta: (text) => out.write({ type: ChatStreamEvent.DELTA, text }),
      reset: () => out.write({ type: ChatStreamEvent.RESET }),
      progress: (progress) => out.write({
        type: ChatStreamEvent.PROGRESS,
        stage: progress.stage,
        ...(progress.detail ? { detail: progress.detail } : {}),
      }),
    });
    this.consume(imageIds);
    out.end({ type: ChatStreamEvent.DONE, ...toChatAnswerDto(answer) });
  };

  /** The turn stored its own copy (user_image artifact): the staged uploads are deleted. A failed answer keeps them for a retry. */
  private consume(imageIds: string[]): void {
    if (imageIds.length > 0) this.uploads?.consume(imageIds);
  }

  private requireUploads(): StagedImageService {
    if (!this.uploads) throw new ServiceDisabledError('Image uploads need object storage on the server');
    return this.uploads;
  }
}
