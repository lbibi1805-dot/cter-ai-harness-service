import { markdownToPdf } from './markdownToPdf';

export const PDF_MIME = 'application/pdf';

export async function buildSuccessPdf(
  originalName: string,
  provider: string,
  model: string,
  aiResponse: string,
): Promise<Buffer> {
  const { buffer, renderLog } = await markdownToPdf(
    'AI Response',
    {
      Provider:  provider,
      Model:     model,
      Original:  originalName,
      Generated: new Date().toISOString(),
    },
    aiResponse,
  );
  if (renderLog.some(r => !r.ok)) {
    console.warn(
      `[render] ${renderLog.length} Mermaid block(s): ` +
      renderLog.filter(r => !r.ok).map(r => `#${r.index}: ${r.error}`).join(' | '),
    );
  }
  return buffer;
}

export async function buildInvalidModelPdf(
  originalName: string,
  provider: string,
  requestedModel: string,
  allowedModels: string[],
): Promise<Buffer> {
  const body = [
    `**ERROR:** Model \`${requestedModel}\` không tồn tại hoặc không được hỗ trợ cho provider **${provider}**.`,
    '',
    '**Các model được hỗ trợ:**',
    ...allowedModels.map(m => `- \`${m}\``),
    '',
    'Vui lòng đổi tên file với model hợp lệ và thử lại.',
  ].join('\n');

  const { buffer } = await markdownToPdf(
    'Invalid Model',
    {
      Provider:  provider,
      Requested: requestedModel,
      Original:  originalName,
      Generated: new Date().toISOString(),
    },
    body,
  );
  return buffer;
}

export async function buildErrorPdf(
  originalName: string,
  provider: string,
  model: string,
  error: Error,
): Promise<Buffer> {
  const body = [
    `**ERROR:** ${error.message}`,
    '',
    'Hệ thống đã thử lại nhiều lần nhưng không thành công.',
    'Vui lòng kiểm tra API key, quota, hoặc thử lại sau.',
  ].join('\n');

  const { buffer } = await markdownToPdf(
    'AI Processing Error',
    {
      Provider:  provider,
      Model:     model,
      Original:  originalName,
      Generated: new Date().toISOString(),
    },
    body,
  );
  return buffer;
}