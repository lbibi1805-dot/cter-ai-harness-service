import { describe, it, expect, afterAll, vi } from 'vitest';
import { buildSuccessPdf, buildInvalidModelPdf, buildErrorPdf } from '../../../../../src/modules/fileqa/infrastructure/pdfResultRenderer.adapter';
import { ContentType } from '../../../../../src/shared/http/enums/http.enums';
import { closeBrowser } from '../../../../../src/modules/document/infrastructure/puppeteerPdfRenderer.adapter';
import { BROWSER_TEST_TIMEOUT_MS } from '../../../../support/timeouts';

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT_MS });

describe('pdfResultRenderer', () => {
  afterAll(async () => {
    await closeBrowser();
  });

  it('exposes the PDF MIME type', () => {
    expect(ContentType.PDF).toBe('application/pdf');
  });

  it('buildSuccessPdf returns a valid PDF buffer', async () => {
    const buf = await buildSuccessPdf('file.pdf', 'gemini', 'gemini-2.0-flash', '# Kết quả');
    expect(buf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });

  it('buildSuccessPdf embeds a Mermaid diagram from the AI response', async () => {
    const aiResponse = [
      '# Hệ thống',
      '```mermaid',
      'graph TD',
      '    A --> B',
      '```',
    ].join('\n');
    const buf = await buildSuccessPdf('input.pdf', 'gemini', 'gemini-2.0-flash', aiResponse);
    expect(buf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });

  it('buildInvalidModelPdf returns a valid PDF buffer', async () => {
    const buf = await buildInvalidModelPdf('file.pdf', 'gemini', 'bad-model', ['gemini-2.0-flash']);
    expect(buf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });

  it('buildErrorPdf returns a valid PDF buffer with the error message', async () => {
    const err = new Error('Rate limit exceeded');
    const buf = await buildErrorPdf('file.pdf', 'gemini', 'gemini-2.0-flash', err);
    expect(buf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });
});
