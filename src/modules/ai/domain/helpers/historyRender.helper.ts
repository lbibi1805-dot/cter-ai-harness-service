import { assistantImageMarker } from '../constants/promptLayers.constants';
import { ConversationRole } from '../enums/ai.enums';
import { RenderedPartKind } from '../enums/historyRender.enums';
import type { RenderedHistory, RenderedPart, RenderedTurn } from '../interfaces/historyRender.interface';
import type { ConversationTurn, PromptContent, PromptImage } from '../interfaces/promptContent.interface';

function textPart(text: string): RenderedPart {
  return { kind: RenderedPartKind.TEXT, text };
}

function imagePart(image: PromptImage): RenderedPart {
  return { kind: RenderedPartKind.IMAGE, image };
}

/** Marker + image for each picture an assistant turn produced. */
function assistantImageParts(images: PromptImage[] | undefined): RenderedPart[] {
  return (images ?? []).flatMap((image) => [textPart(assistantImageMarker(image.alias)), imagePart(image)]);
}

/**
 * Hot-window history (note 18 step 5) in one provider-neutral layout, so every adapter sends the same order:
 * - user turn: [images the previous assistant turn drew, each after its marker] + text + its own images;
 * - assistant turn: text only (OpenAI/Claude reject images in the assistant role, Gemini `model` is unreliable);
 * - the images of the last assistant turn become `lead`: the start of the current user message.
 * A turn without images keeps `hasImages: false` and is sent as plain text, byte-identical to before.
 */
export function renderHistory(history: ConversationTurn[] | undefined): RenderedHistory {
  const turns: RenderedTurn[] = [];
  let carried: RenderedPart[] = [];
  for (const turn of history ?? []) {
    if (turn.role === ConversationRole.ASSISTANT) {
      turns.push({ role: turn.role, text: turn.text, parts: [textPart(turn.text)], hasImages: false });
      carried = assistantImageParts(turn.images);
      continue;
    }
    const own = (turn.images ?? []).map(imagePart);
    const parts = [...carried, textPart(turn.text), ...own];
    turns.push({ role: turn.role, text: turn.text, parts, hasImages: carried.length + own.length > 0 });
    carried = [];
  }
  return { turns, lead: carried };
}

/** The current user message: lead (last assistant turn's drawings) + question text + current/JIT images. */
export function currentUserParts(content: PromptContent, lead: RenderedPart[]): RenderedPart[] {
  return [
    ...lead,
    ...(content.textContent ? [textPart(content.textContent)] : []),
    ...content.imageBuffers.map(imagePart),
  ];
}

/** Every image a request sends: history window + current + JIT (size guards, Files API decisions). */
export function allPromptImages(content: PromptContent): PromptImage[] {
  return [...(content.history ?? []).flatMap((turn) => turn.images ?? []), ...content.imageBuffers];
}
