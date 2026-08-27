// This module must be imported before pdfjs-dist anywhere else.
// It configures GlobalWorkerOptions while pdfjs-dist is first loaded
// so the cached module is already configured when fileExtractor imports it.

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfjsLib = require('pdfjs-dist');

// workerSrc must be a non-empty string — pdfjs-dist treats '' as "not specified"
// and throws before reaching the fake-worker fallback.
// Pointing at the real worker file path lets pdfjs attempt to spawn a worker;
// when that fails in Node.js (no browser Worker API), it falls back inline.
// eslint-disable-next-line @typescript-eslint/no-require-imports
pdfjsLib.GlobalWorkerOptions.workerSrc = require.resolve('pdfjs-dist/build/pdf.worker.js');
