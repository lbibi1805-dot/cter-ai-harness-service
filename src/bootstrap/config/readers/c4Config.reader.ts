import {
  DEFAULT_C4_CALL_TIMEOUT_MS,
  DEFAULT_C4_DEADLINE_MS,
  DEFAULT_C4_INCLUDE_BASE,
  DEFAULT_MAX_ELEMENTS,
  DEFAULT_PLANTUML_SERVER_URL,
  type C4Config,
} from '../../../modules/c4';
import { readBoolean, readInt, readString } from '../../../shared/config/env';

/** /api/c4 settings; every value has a default, so the sketcher works without any C4_* variable. */
export function readC4Config(): C4Config {
  return {
    plantUmlServerUrl: readString('C4_PLANTUML_SERVER_URL', DEFAULT_PLANTUML_SERVER_URL),
    includeBase: readString('C4_INCLUDE_BASE', DEFAULT_C4_INCLUDE_BASE),
    deadlineMs: readInt('C4_DEADLINE_MS', DEFAULT_C4_DEADLINE_MS),
    callTimeoutMs: readInt('C4_CALL_TIMEOUT_MS', DEFAULT_C4_CALL_TIMEOUT_MS),
    maxElements: readInt('C4_MAX_ELEMENTS', DEFAULT_MAX_ELEMENTS),
    showLegend: readBoolean('C4_SHOW_LEGEND', false),
  };
}
