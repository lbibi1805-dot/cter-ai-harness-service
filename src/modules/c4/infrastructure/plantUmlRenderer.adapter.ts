import { UpstreamError } from '../../../shared/errors';
import { HttpStatus } from '../../../shared/http/enums/http.enums';
import { retryTransient, withTimeout, type Sleep } from '../../../shared/resilience';
import type { DiagramRender, DiagramRenderer } from '../domain';
import {
  DEFAULT_PLANTUML_SERVER_URL,
  PLANTUML_BACKOFF,
  PLANTUML_ERROR_HEADER,
  PLANTUML_ERROR_LINE_HEADER,
  PLANTUML_MAX_ATTEMPTS,
  PLANTUML_TIMEOUT_MS,
  PNG_PATH,
  TRAILING_SLASHES,
} from './constants/plantUml.constants';
import { encodePlantUml } from './helpers/plantUmlEncoding.helper';

/**
 * Renders through a PlantUML server (GET {server}/png/{encoded}), like generate-diagram-image in
 * c4-plantuml-mcp-server. Syntax errors come back from the X-PlantUML-Diagram-Error headers so the repair
 * agent can fix them; network/429/5xx failures are retried, anything else becomes an UpstreamError.
 */
export class PlantUmlRendererAdapter implements DiagramRenderer {
  private readonly server: string;

  constructor(serverUrl: string = DEFAULT_PLANTUML_SERVER_URL, private readonly sleep?: Sleep) {
    this.server = serverUrl.replace(TRAILING_SLASHES, '');
  }

  render(puml: string): Promise<DiagramRender> {
    const url = `${this.server}${PNG_PATH}${encodePlantUml(puml)}`;
    return retryTransient(() => withTimeout(this.fetchPng(url), PLANTUML_TIMEOUT_MS, 'plantuml'), {
      maxAttempts: PLANTUML_MAX_ATTEMPTS,
      backoff: PLANTUML_BACKOFF,
      sleep: this.sleep,
    });
  }

  private async fetchPng(url: string): Promise<DiagramRender> {
    const res = await fetch(url);
    const syntaxError = res.headers.get(PLANTUML_ERROR_HEADER);
    if (syntaxError) {
      const line = Number.parseInt(res.headers.get(PLANTUML_ERROR_LINE_HEADER) ?? '', 10);
      return { syntaxError, errorLine: Number.isFinite(line) ? line : undefined };
    }
    if (res.status === HttpStatus.BAD_REQUEST) return { syntaxError: 'PlantUML rejected the source (400)' };
    if (!res.ok) throw new UpstreamError(`PlantUML server: ${res.status} ${res.statusText}`, res.status);
    return { png: Buffer.from(await res.arrayBuffer()) };
  }
}
