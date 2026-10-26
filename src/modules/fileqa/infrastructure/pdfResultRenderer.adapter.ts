import { logger } from '../../../shared/logging/logger';
import { markdownToPdf } from '../../document';
import type { ResultRenderer } from '../domain/interfaces/resultRenderer.port';
import { PdfTitle } from './enums/pdfResultRenderer.enums';
import { generatedAt } from './helpers/pdfResultRenderer.helper';

export async function buildSuccessPdf(
  originalName: string,
  provider: string,
  model: string,
  aiResponse: string,
  details: Record<string, string> = {},
): Promise<Buffer> {
  const { buffer, renderLog } = await markdownToPdf(
    PdfTitle.SUCCESS,
    { Provider: provider, Model: model, ...details, Original: originalName, Generated: generatedAt() },
    aiResponse,
  );
  const failed = renderLog.filter((entry) => !entry.ok);
  if (failed.length > 0) {
    logger.warn(`[render] ${renderLog.length} Mermaid block(s): ${failed.map((entry) => `#${entry.index}: ${entry.error}`).join(' | ')}`);
  }
  return buffer;
}

export async function buildInvalidModelPdf(originalName: string, provider: string, requestedModel: string, allowedModels: string[]): Promise<Buffer> {
  const body = [
    `**ERROR:** Model \`${requestedModel}\` không tồn tại hoặc không được hỗ trợ cho provider **${provider}**.`,
    '',
    '**Các model được hỗ trợ:**',
    ...allowedModels.map((model) => `- \`${model}\``),
    '',
    'Vui lòng đổi tên file với model hợp lệ và thử lại.',
  ].join('\n');
  const { buffer } = await markdownToPdf(
    PdfTitle.INVALID_MODEL,
    { Provider: provider, Requested: requestedModel, Original: originalName, Generated: generatedAt() },
    body,
  );
  return buffer;
}

export async function buildErrorPdf(originalName: string, provider: string, model: string, error: Error): Promise<Buffer> {
  const body = [
    `**ERROR:** ${error.message}`,
    '',
    'Hệ thống đã thử lại nhiều lần nhưng không thành công.',
    'Vui lòng kiểm tra API key, quota, hoặc thử lại sau.',
  ].join('\n');
  const { buffer } = await markdownToPdf(
    PdfTitle.ERROR,
    { Provider: provider, Model: model, Original: originalName, Generated: generatedAt() },
    body,
  );
  return buffer;
}

/** Renders every outcome as a PDF (Markdown + Mermaid + KaTeX in headless Chromium). */
export const PDF_RESULT_RENDERER: ResultRenderer = {
  success: buildSuccessPdf,
  error: buildErrorPdf,
  invalidModel: buildInvalidModelPdf,
};
