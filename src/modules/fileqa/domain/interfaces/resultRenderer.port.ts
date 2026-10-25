/** Builds the PDF uploaded back to Canvas for each outcome. */
export interface ResultRenderer {
  success(originalName: string, provider: string, model: string, answer: string, details?: Record<string, string>): Promise<Buffer>;
  error(originalName: string, provider: string, model: string, error: Error): Promise<Buffer>;
  invalidModel(originalName: string, provider: string, model: string, allowed: string[]): Promise<Buffer>;
}
