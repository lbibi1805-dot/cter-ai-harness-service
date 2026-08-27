import mammoth from 'mammoth';
// pdfSetup must be imported first — it loads pdfjs-dist and sets GlobalWorkerOptions
// before this module gets the cached reference, avoiding the "no workerSrc" error.
import './pdfSetup';
import { createCanvas } from '@napi-rs/canvas';
import * as pdfjsLib from 'pdfjs-dist';
import type { FileContent } from '../types';

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

const MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

const MAX_PDF_PAGES = 20;
const PDF_RENDER_SCALE = 2.0;

type Extractor = (buffer: Buffer, ext: string) => FileContent | Promise<FileContent>;

const TEXT_EXTRACTOR: Extractor = (buffer) => ({
  textContent: buffer.toString('utf-8'),
  imageBuffers: [],
});

const IMAGE_EXTRACTOR: Extractor = (buffer, ext) => ({
  textContent: '',
  imageBuffers: [{ data: buffer, mimeType: MIME_MAP[ext] ?? 'image/jpeg' }],
});

const EXTRACTOR_REGISTRY: Record<string, Extractor> = {
  '.txt': TEXT_EXTRACTOR,
  '.md': TEXT_EXTRACTOR,
  '.docx': extractDocx,
  '.pdf': extractPdf,
  ...Object.fromEntries([...IMAGE_EXTENSIONS].map(ext => [ext, IMAGE_EXTRACTOR])),
};

export async function extractContent(buffer: Buffer, extension: string): Promise<FileContent> {
  const ext = extension.toLowerCase();
  const extractor = EXTRACTOR_REGISTRY[ext] ?? TEXT_EXTRACTOR;
  return extractor(buffer, ext);
}

async function extractDocx(buffer: Buffer): Promise<FileContent> {
  const images: { data: Buffer; mimeType: string }[] = [];

  await mammoth.convertToHtml(
    { buffer },
    {
      convertImage: mammoth.images.imgElement(async (image) => {
        const imgBuffer = await image.readAsBuffer();
        images.push({ data: imgBuffer, mimeType: image.contentType });
        return { src: '' };
      }),
    }
  );

  const textResult = await mammoth.extractRawText({ buffer });
  return { textContent: textResult.value, imageBuffers: images };
}

// Node.js canvas factory required by pdfjs-dist for page rendering
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nodeCanvasFactory: Record<string, (...args: any[]) => any> = {
  create(width: number, height: number) {
    const canvas = createCanvas(width, height);
    return { canvas, context: canvas.getContext('2d') };
  },
  reset(pair: { canvas: ReturnType<typeof createCanvas> }, width: number, height: number) {
    pair.canvas.width = width;
    pair.canvas.height = height;
  },
  destroy(pair: { canvas: ReturnType<typeof createCanvas> }) {
    pair.canvas.width = 0;
    pair.canvas.height = 0;
  },
};

async function extractPdf(buffer: Buffer): Promise<FileContent> {
  const images: { data: Buffer; mimeType: string }[] = [];
  const textParts: string[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loadingTask = (pdfjsLib.getDocument as any)({ data: new Uint8Array(buffer) });
  const pdf = await loadingTask.promise;
  const pageCount = Math.min(pdf.numPages as number, MAX_PDF_PAGES);

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await pdf.getPage(pageNum);

    // Extract text from this page
    try {
      const content = await page.getTextContent();
      const pageText = (content.items as Array<{ str?: string }>)
        .map((item) => item.str ?? '')
        .join(' ')
        .trim();
      if (pageText) textParts.push(pageText);
    } catch {
      // Skip text for this page on failure
    }

    // Render page to PNG
    try {
      const viewport = page.getViewport({ scale: PDF_RENDER_SCALE });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const context = canvas.getContext('2d');

      // canvasFactory is a Node.js-only runtime param not in pdfjs TS types
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (page.render as any)({
        canvasContext: context,
        viewport,
        canvasFactory: nodeCanvasFactory,
      }).promise;

      const pngData = await canvas.encode('png');
      images.push({ data: pngData, mimeType: 'image/png' });
    } catch {
      // Skip image for this page on failure
    }
  }

  return { textContent: textParts.join('\n\n'), imageBuffers: images };
}
