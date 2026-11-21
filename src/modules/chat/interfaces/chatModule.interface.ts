import type { PromptTrace } from '../presentation/interfaces/promptTrace.interface';
import type { Router } from '../../../shared/http/router';
import type { Answerer } from '../../agent/domain';
import type { AIProvider, ModelCatalog } from '../../ai';
import type { ChatTurns } from '../application/interfaces/chatTurns.interface';
import type { EssayAuxInput, EssayAuxSession, EssayWriter } from '../application/interfaces/chat.interface';
import type { ChatLimits } from '../presentation/interfaces/chatLimits.interface';
import type { ObjectStorage } from '../../../shared/storage';
import type { StagedImageService } from '../application/stagedImages.service';
import type { ImageResizer } from '../application/interfaces/stagedImages.interface';

export interface ChatModuleConfig {
  /** Bearer token for `/api/chat`; unset disables the API (fails closed). */
  chatApiToken?: string;
  /** Body size / image limits; absent = defaults (20 MB body, 10 images, 15 MB inline images for Gemini). */
  limits?: ChatLimits;
}

export interface ChatModuleDeps {
  answers: Answerer;
  catalog: ModelCatalog;
  agentEnabled: boolean;
  isProviderConfigured: (provider: AIProvider) => boolean;
  /** Server-side conversation memory (context module); absent = stateless. */
  turns?: ChatTurns;
  /** Essay Mode (EssayService); absent without retrieval. */
  essay?: EssayWriter;
  /** Essay Mode: per-request router session (routing + essay analysis in one aux call); absent = essay analyses alone. */
  essayAux?: (input: EssayAuxInput) => EssayAuxSession | null;
  /** Object storage for upload-first images (`tmp/uploads/`); absent = `/api/chat/images` answers 503. */
  storage?: ObjectStorage;
  /** Test hook: image downscaler (default `@napi-rs/canvas`). */
  resizer?: ImageResizer | null;
  now?: () => number;
  /** `trace.prompt` (12/11 02 Bước 6): prompt composition of a path; absent = no prompt trace. */
  promptTrace?: PromptTrace;
}

export interface ChatModule {
  router: Router;
  enabled: boolean;
  /** Upload-first images, shared with /api/c4 (`imageIds`); null without object storage. */
  uploads: StagedImageService | null;
}
