// Chạy toàn bộ bộ câu hỏi test qua pipeline Mermaid → PDF.
// Usage: npx tsx scripts/run-questions.ts
import { markdownToPdf, closeBrowser } from '../src/utils/markdownToPdf';
import * as fs from 'fs';
import * as path from 'path';

const QUESTIONS_DIR = path.resolve(__dirname, '..', 'test-questions');
const OUT_DIR = path.resolve(__dirname, '..', 'test-questions-out');

async function main(): Promise<void> {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const files = fs.readdirSync(QUESTIONS_DIR).filter(f => f.endsWith('.md')).sort();
  let pass = 0;
  let fail = 0;

  console.log(`Chạy ${files.length} câu hỏi test qua pipeline Mermaid → PDF...\n`);

  for (const file of files) {
    const content = fs.readFileSync(path.join(QUESTIONS_DIR, file), 'utf8');
    const outBase = file.replace(/\.md$/, '');
    try {
      const { buffer, renderLog } = await markdownToPdf(
        `Test: ${file}`,
        { File: file, Generated: new Date().toISOString() },
        content,
      );

      const outPdf = path.join(OUT_DIR, `${outBase}.pdf`);
      fs.writeFileSync(outPdf, buffer);

      const allOk = renderLog.every(r => r.ok);
      // T08 cố tình chứa block Mermaid sai → kỳ vọng fallback hoạt động:
      // đúng 1 block ok, đúng 1 block fail kèm error, nhưng PDF vẫn hợp lệ.
      const isBrokenMermaidTest = /T08/.test(file);
      const brokenOk = isBrokenMermaidTest
        && renderLog.filter(r => r.ok).length === 1
        && renderLog.filter(r => !r.ok).length === 1
        && renderLog.some(r => !r.ok && !!r.error)
        && buffer.subarray(0, 5).toString('ascii') === '%PDF-';
      const passThis = isBrokenMermaidTest ? brokenOk : allOk;
      const status = passThis ? 'PASS' : 'FAIL';
      if (passThis) pass += 1; else fail += 1;

      console.log(`[${status}] ${file}`);
      console.log(`        PDF: ${outPdf} (${buffer.length} bytes) [header ${buffer.subarray(0, 5).toString('ascii')}]`);
      if (renderLog.length === 0) {
        console.log(`        renderLog: (không có block mermaid)`);
      } else {
        renderLog.forEach(r =>
          console.log(`        renderLog block#${r.index}: ok=${r.ok}${r.error ? ` error="${r.error}"` : ''}`));
      }
      console.log('');
    } catch (err) {
      fail += 1;
      console.log(`[FAIL] ${file} — EXCEPTION: ${(err as Error).message}\n`);
    }
  }

  await closeBrowser();
  console.log(`\nKết quả: ${pass} PASS / ${fail} FAIL / ${files.length} total`);
  if (fail > 0) process.exitCode = 1;
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });