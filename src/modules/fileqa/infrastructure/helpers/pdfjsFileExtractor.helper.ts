// pdfjsSetup must load before pdfjs-dist: it sets GlobalWorkerOptions on the cached module.
import '../pdfjsSetup';
import { createCanvas } from '@napi-rs/canvas';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import { ContentType } from '../../../../shared/http/enums/http.enums';
import { attempt } from '../../../../shared/resilience/attempt';
import { PromptContent, PromptImage } from '../../../ai/domain/interfaces/promptContent.interface';
import { PAGE_TEXT_SEPARATOR, IMAGE_MIME_TYPES, MAX_PDF_PAGES, PDF_RENDER_SCALE } from '../constants/pdfjsFileExtractor.constants';
import { CanvasPair, PdfPage, Extractor, GetDocument } from '../interfaces/pdfjsFileExtractor.interface';

/** pdfjs needs a canvas factory in Node to render pages. */
export const NODE_CANVAS_FACTORY = {
  create(width: number, height: number) {
    const canvas = createCanvas(width, height);
    return { canvas, context: canvas.getContext('2d') };
  },
  reset(pair: CanvasPair, width: number, height: number) {
    pair.canvas.width = width;
    pair.canvas.height = height;
  },
  destroy(pair: CanvasPair) {
    pair.canvas.width = 0;
    pair.canvas.height = 0;
  },
};

export const extractText: Extractor = (buffer) => ({ textContent: buffer.toString('utf-8'), imageBuffers: [] });

export const extractImage: Extractor = (buffer, extension) => ({
  textContent: '',
  imageBuffers: [{ data: buffer, mimeType: IMAGE_MIME_TYPES[extension] ?? ContentType.JPEG }],
});

export async function extractDocx(buffer: Buffer): Promise<PromptContent> {
  const images: PromptImage[] = [];
  await mammoth.convertToHtml(
    { buffer },
    {
      convertImage: mammoth.images.imgElement(async (image) => {
        images.push({ data: await image.readAsBuffer(), mimeType: image.contentType });
        return { src: '' };
      }),
    },
  );
  const text = await mammoth.extractRawText({ buffer });
  return { textContent: text.value, imageBuffers: images };
}

/** Text and a PNG snapshot per page; a page whose text or image fails is skipped, not fatal. */
export async function extractPdf(buffer: Buffer): Promise<PromptContent> {
  const getDocument = pdfjsLib.getDocument as unknown as GetDocument;
  const pdf = await getDocument({ data: new Uint8Array(buffer) }).promise;
  const pageCount = Math.min(pdf.numPages, MAX_PDF_PAGES);
  const textParts: string[] = [];
  const images: PromptImage[] = [];

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const text = await attempt(() => pageText(page));
    if (text.ok && text.value) textParts.push(text.value);
    const image = await attempt(() => renderPage(page));
    if (image.ok) images.push(image.value);
  }
  return { textContent: textParts.join(PAGE_TEXT_SEPARATOR), imageBuffers: images };
}

export async function pageText(page: PdfPage): Promise<string> {
  const content = await page.getTextContent();
  return content.items.map((item) => item.str ?? '').join(' ').trim();
}

export async function renderPage(page: PdfPage): Promise<PromptImage> {
  const viewport = page.getViewport({ scale: PDF_RENDER_SCALE });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  await page.render({ canvasContext: canvas.getContext('2d'), viewport, canvasFactory: NODE_CANVAS_FACTORY }).promise;
  return { data: await canvas.encode('png'), mimeType: ContentType.PNG };
}
