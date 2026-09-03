import { Marked } from 'marked';
import path from 'path';
import fs from 'fs';
import os from 'os';
import puppeteer, { type Browser, type Page } from 'puppeteer';
import { normalizeMathDelimiters } from './mathNormalizer';

// Render markdown (with Mermaid fenced blocks and LaTeX math) to a PDF buffer
// using Puppeteer's headless Chromium. Mermaid is rendered natively in the
// browser (same engine Obsidian uses), KaTeX renders the math, and the page is
// then printed to PDF. Failing Mermaid blocks degrade to raw-code blocks while
// the render log is collected for the caller to inspect.

export interface PdfRenderLog {
  index: number;
  ok: boolean;
  error?: string;
}

export interface PdfRenderResult {
  buffer: Buffer;
  renderLog: PdfRenderLog[];
}

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

let browserPromise: Promise<Browser> | undefined;

export async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files'],
    });
  }
  return browserPromise;
}

export async function closeBrowser(): Promise<void> {
  if (browserPromise) {
    const b = await browserPromise;
    browserPromise = undefined;
    await b.close();
  }
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildMarked(): Marked {
  const md = new Marked();
  md.use({
    renderer: {
      code({ text, lang }) {
        const language = (lang || '').toLowerCase();
        let body = escapeHtml(text);
        // Preserve leading indent for PDF copy-paste: convert leading spaces to &nbsp;
        body = body.replace(/^( +)/gm, (m) => '&nbsp;'.repeat(m.length));
        // Also preserve tabs
        body = body.replace(/\t/g, '&nbsp;&nbsp;');
        if (language === 'mermaid') {
          return `<pre class="mermaid">${body}</pre>`;
        }
        const cls = language ? `language-${escapeHtml(language)}` : '';
        return `<pre><code class="${cls}">${body}</code></pre>`;
      },
    },
  });
  return md;
}

export async function collectAssetPaths(): Promise<{ katexCss: string; katexJs: string; autoRenderJs: string; mermaidJs: string }> {
  const nm = path.join(PROJECT_ROOT, 'node_modules');
  return {
    katexCss: path.join(nm, 'katex', 'dist', 'katex.min.css'),
    katexJs: path.join(nm, 'katex', 'dist', 'katex.min.js'),
    autoRenderJs: path.join(nm, 'katex', 'dist', 'contrib', 'auto-render.min.js'),
    mermaidJs: path.join(nm, 'mermaid', 'dist', 'mermaid.min.js'),
  };
}

export function normalizeCodeBlocks(body: string): string {
  const lines = body.split('\n');
  let inFence = false;
  const out: string[] = [];

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (trimmed.startsWith('```')) {
      inFence = !inFence;
      out.push(rawLine);
      continue;
    }
    if (inFence) {
      out.push(rawLine);
      continue;
    }

    // Heuristic: long line outside fence that looks like collapsed C code
    const hasCodeKeyword = /pthread_|void\s*\*|static\s+pthread|int\s+\w+\s*[=;]|\bChannelCreate\b|\bMsgSend\b/.test(rawLine);
    const semicolonCount = (rawLine.match(/;/g) || []).length;
    const hasBraces = rawLine.includes('{') || rawLine.includes('}');

    if (hasCodeKeyword && semicolonCount >= 2 && rawLine.length > 80) {
      let code = rawLine
        .replace(/;\s*/g, ';\n')
        .replace(/\{\s*/g, '{\n')
        .replace(/\}\s*/g, '\n}\n')
        .replace(/\n\s*\n/g, '\n')
        .trim();
      // Clean up extra newlines around braces
      code = code.replace(/\n\{\n/g, ' {\n').replace(/\n\}\n/g, '\n}');
      out.push('```c');
      out.push(code);
      out.push('```');
    } else {
      out.push(rawLine);
    }
  }
  return out.join('\n');
}

export function pathToFileUrl(p: string): string {
  const resolved = path.resolve(p);
  const normalized = resolved.replace(/\\/g, '/');
  return `file://${normalized.startsWith('/') ? '' : '/'}${encodeURI(normalized).replace(/%2F/gi, '/')}`;
}

export function buildPageHtml(title: string, meta: Record<string, string>, bodyHtml: string): string {
  const metaRows = Object.entries(meta)
    .map(([k, v]) => `<div class="meta"><span class="meta-key">${escapeHtml(k)}:</span> ${escapeHtml(v)}</div>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<link rel="stylesheet" href="__KATEX_CSS__">
<style>
  @page { size: A4; margin: 18mm 16mm; }
  html { font-size: 11pt; }
  body {
    font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
    color: #202020; line-height: 1.55; margin: 0;
  }
  h1.title { font-size: 20pt; margin: 0 0 4pt 0; }
  .meta { color: #4a4a4a; font-size: 9.5pt; margin: 1pt 0; }
  .meta-key { font-weight: 600; }
  hr.sep { border: 0; border-top: 1px solid #cccccc; margin: 12pt 0 14pt 0; }
  h1, h2, h3, h4, h5, h6 { color: #111; line-height: 1.25; margin: 14pt 0 6pt 0; }
  h1 { font-size: 16pt; } h2 { font-size: 14pt; } h3 { font-size: 12.5pt; }
  h4 { font-size: 11.5pt; } h5 { font-size: 11pt; } h6 { font-size: 10.5pt; }
  p { margin: 6pt 0; }
  ul, ol { margin: 6pt 0; padding-left: 22pt; }
  li { margin: 2pt 0; }
  blockquote {
    margin: 8pt 0; padding: 2pt 12pt; border-left: 3px solid #999;
    color: #555; background: #f7f7f7;
  }
  code { font-family: 'Consolas', 'Courier New', monospace; background: #f1f1f1; padding: 1pt 3pt; border-radius: 3px; font-size: 9.5pt; }
  pre { background: #f6f6f6; border: 1px solid #ddd; border-radius: 4px; padding: 8pt 10pt; overflow: hidden; white-space: pre; tab-size: 2; -moz-tab-size: 2; word-wrap: normal; }
  pre code { background: none; padding: 0; white-space: pre; tab-size: 2; -moz-tab-size: 2; font-variant-ligatures: none; }
  table { border-collapse: collapse; width: 100%; margin: 8pt 0; }
  th, td { border: 1px solid #bbb; padding: 4pt 8pt; text-align: left; font-size: 9.5pt; }
  th { background: #eee; font-weight: 600; }
  pre.mermaid { text-align: center; background: #fff; border: 1px solid #eee; overflow: visible; }
  pre.mermaid-fallback {
    background: #fff4f4; border-color: #e6b8b8; color: #991515;
    text-align: left; white-space: pre-wrap; font-family: Consolas, monospace;
  }
  img { max-width: 100%; height: auto; }
  .katex { font-size: 1.05em; }
</style>
</head>
<body>
  <h1 class="title">${escapeHtml(title)}</h1>
  ${metaRows}
  <hr class="sep">
  ${bodyHtml}
  <script src="__KATEX_JS__"></script>
  <script src="__AUTORENDER_JS__"></script>
  <script src="__MERMAID_JS__"></script>
  <script>
  (async () => {
    const logs = [];
    if (window.renderMathInElement) {
      try {
        window.renderMathInElement(document.body, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false }
          ],
          throwOnError: false
        });
      } catch (e) { logs.push('math:' + e.message); }
    }
    if (window.mermaid) {
      try { window.mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'strict' }); }
      catch (e) { logs.push('mermaid-init:' + e.message); }
      const blocks = document.querySelectorAll('pre.mermaid');
      for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i];
        const src = b.textContent || '';
        try {
          const { svg } = await window.mermaid.render('mermaid-graph-' + i, src);
          b.innerHTML = svg;
          logs.push('mermaid-block-' + i + ':ok');
        } catch (e) {
          logs.push('mermaid-block-' + i + ':error:' + e.message);
          const fallback = document.createElement('pre');
          fallback.className = 'mermaid-fallback';
          fallback.textContent = src;
          b.innerHTML = '';
          b.appendChild(fallback);
        }
      }
    }
    window.__pdfRenderDone = true;
    window.__pdfRenderLogs = logs;
  })();
  </script>
</body>
</html>`;
}

export async function markdownToPdf(
  title: string,
  meta: Record<string, string>,
  body: string,
): Promise<PdfRenderResult> {
  const assets = await collectAssetPaths();
  if (!fs.existsSync(assets.mermaidJs)) throw new Error(`mermaid dist not found: ${assets.mermaidJs}`);
  if (!fs.existsSync(assets.katexCss) || !fs.existsSync(assets.katexJs) || !fs.existsSync(assets.autoRenderJs)) {
    throw new Error('katex dist not found');
  }

  const normalizedCode = normalizeCodeBlocks(body);
  const normalized = normalizeMathDelimiters(normalizedCode);
  const md = buildMarked();
  const bodyHtml = md.parse(normalized) as string;

  const pageHtml = buildPageHtml(title, meta, bodyHtml)
    .replace('__KATEX_CSS__', pathToFileUrl(assets.katexCss))
    .replace('__KATEX_JS__', pathToFileUrl(assets.katexJs))
    .replace('__AUTORENDER_JS__', pathToFileUrl(assets.autoRenderJs))
    .replace('__MERMAID_JS__', pathToFileUrl(assets.mermaidJs));

  const browser = await getBrowser();
  const page = await browser.newPage();
  const tmpFile = path.join(os.tmpdir(), `canvas-helper-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.html`);
  fs.writeFileSync(tmpFile, pageHtml, 'utf8');
  try {
    await page.setViewport({ width: 900, height: 1200, deviceScaleFactor: 1 });
    await page.goto(pathToFileUrl(tmpFile), { waitUntil: 'load' });
    await page.waitForFunction(() => (window as any).__pdfRenderDone === true, { timeout: 30000 });

    const rawLogs = (await page.evaluate(() => (window as any).__pdfRenderLogs || [])) as string[];
    const renderLog: PdfRenderResult['renderLog'] = rawLogs
      .filter(l => l.startsWith('mermaid-block-'))
      .map(l => {
        const marker = 'mermaid-block-';
        const rest = l.slice(marker.length);
        const sep = rest.indexOf(':');
        const idx = Number(rest.slice(0, sep));
        const state = rest.slice(sep + 1).split(':')[0];
        const err = rest.slice(sep + 1).startsWith('error:') ? rest.slice(sep + 1 + 'error:'.length) : undefined;
        return { index: idx, ok: state === 'ok', error: err };
      });

    const pdf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });

    if (rawLogs.some(l => l.startsWith('mermaid-block-') && l.includes(':error:'))) {
      console.error(`[render] ${rawLogs.filter(l => l.includes(':error:')).join(' | ')}`);
    }

    return { buffer: Buffer.from(pdf), renderLog };
  } finally {
    try { fs.unlinkSync(tmpFile); } catch { /* noop */ }
    await page.close();
  }
}