export interface PdfRenderLog {
  index: number;
  ok: boolean;
  error?: string;
}

export interface PdfRenderResult {
  buffer: Buffer;
  renderLog: PdfRenderLog[];
}

/** Flags the in-page script sets on `window` once rendering finished. */
export interface RenderWindow {
  __pdfRenderDone?: boolean;
  __pdfRenderLogs?: string[];
}
