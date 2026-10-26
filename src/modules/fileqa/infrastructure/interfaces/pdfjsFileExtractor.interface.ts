import { type Canvas } from '@napi-rs/canvas';
import { PromptContent } from '../../../ai/domain/interfaces/promptContent.interface';

/** Minimal pdfjs-dist shapes: its bundled types do not cover the Node canvas factory. */
export interface PdfViewport {
  width: number;
  height: number;
}

export interface PdfPage {
  getTextContent(): Promise<{ items: Array<{ str?: string }> }>;
  getViewport(options: { scale: number }): PdfViewport;
  render(options: { canvasContext: unknown; viewport: PdfViewport; canvasFactory: unknown }): { promise: Promise<void> };
}

export interface PdfDocument {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfPage>;
}

export type GetDocument = (source: { data: Uint8Array }) => { promise: Promise<PdfDocument> };

export interface CanvasPair {
  canvas: Canvas;
}

/** Turns a downloaded file into prompt text and images. */
export type Extractor = (buffer: Buffer, extension: string) => PromptContent | Promise<PromptContent>;
