import { describe, it, expect, afterAll } from 'vitest';
import { buildSuccessPdf, buildInvalidModelPdf, buildErrorPdf, PDF_MIME } from './resultBuilder';
import { closeBrowser } from './markdownToPdf';

describe('resultBuilder — PDF output (was DOCX)', () => {
  afterAll(async () => {
    await closeBrowser();
  });

  it('exposes the PDF MIME type', () => {
    expect(PDF_MIME).toBe('application/pdf');
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
