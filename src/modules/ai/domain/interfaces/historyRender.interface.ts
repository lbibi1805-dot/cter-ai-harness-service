import type { ConversationRole } from '../enums/ai.enums';
import type { RenderedPartKind } from '../enums/historyRender.enums';
import type { PromptImage } from './promptContent.interface';

export type RenderedPart =
  | { kind: RenderedPartKind.TEXT; text: string }
  | { kind: RenderedPartKind.IMAGE; image: PromptImage };

/** One history turn as the providers receive it. `hasImages` = false → render as plain text (old bytes). */
export interface RenderedTurn {
  role: ConversationRole;
  text: string;
  parts: RenderedPart[];
  hasImages: boolean;
}

/** History ready for an adapter, plus what goes in front of the current user message. */
export interface RenderedHistory {
  turns: RenderedTurn[];
  /** Images the last assistant turn drew (with their markers): the start of the current user message. */
  lead: RenderedPart[];
}

/** Shape `normalizeHistory` works on: a turn whose images may be loaded bytes or artifact rows still to load. */
export interface HistoryLike {
  role: ConversationRole;
  text: string;
  images?: unknown[];
}
