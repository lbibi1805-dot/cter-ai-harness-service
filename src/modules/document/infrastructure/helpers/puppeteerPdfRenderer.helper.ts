import { PdfRenderLog } from '../interfaces/puppeteerPdfRenderer.interface';
import { MERMAID_LOG_PREFIX, MERMAID_ERROR_MARKER } from '../constants/puppeteerPdfRenderer.constants';

/** `mermaid-block-3:ok` / `mermaid-block-3:error:<message>` → structured entry. */
export function parseMermaidLog(line: string): PdfRenderLog {
  const rest = line.slice(MERMAID_LOG_PREFIX.length);
  const separator = rest.indexOf(':');
  const outcome = rest.slice(separator + 1);
  const failed = outcome.startsWith(MERMAID_ERROR_MARKER);
  return {
    index: Number(rest.slice(0, separator)),
    ok: !failed,
    error: failed ? outcome.slice(MERMAID_ERROR_MARKER.length) : undefined,
  };
}
