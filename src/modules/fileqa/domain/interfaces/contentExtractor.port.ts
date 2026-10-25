import { PromptContent } from '../../../ai/domain/interfaces/promptContent.interface';

/** Turns a downloaded file into prompt content (text and/or page images). */
export type ContentExtractor = (buffer: Buffer, extension: string) => Promise<PromptContent>;
