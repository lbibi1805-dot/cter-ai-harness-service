// pdfjsSetup must be imported first — it loads pdfjs-dist and sets GlobalWorkerOptions
// before this module gets the cached reference, avoiding the "no workerSrc" error.
import type { ContentExtractor } from '../domain/interfaces/contentExtractor.port';
import './pdfjsSetup';
import { Extractor } from './interfaces/pdfjsFileExtractor.interface';
import { extractText, extractDocx, extractPdf, extractImage } from './helpers/pdfjsFileExtractor.helper';
import { FileExtension } from './enums/pdfjsFileExtractor.enums';
import { IMAGE_MIME_TYPES } from './constants/pdfjsFileExtractor.constants';

const EXTRACTORS: Readonly<Record<string, Extractor>> = {
  [FileExtension.TXT]: extractText,
  [FileExtension.MD]: extractText,
  [FileExtension.DOCX]: extractDocx,
  [FileExtension.PDF]: extractPdf,
  ...Object.fromEntries(Object.keys(IMAGE_MIME_TYPES).map((extension) => [extension, extractImage])),
};

/** Unknown extensions are read as plain text. */
export const extractContent: ContentExtractor = async (buffer, extension) => {
  const normalized = extension.toLowerCase();
  return (EXTRACTORS[normalized] ?? extractText)(buffer, normalized);
};
