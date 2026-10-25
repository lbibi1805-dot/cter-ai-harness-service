import { PromptImage } from './interfaces/promptContent.interface';

export function toDataUrl(image: PromptImage): string {
  return `data:${image.mimeType};base64,${image.data.toString('base64')}`;
}
