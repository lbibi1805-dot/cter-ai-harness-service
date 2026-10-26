import { AGENT_FILE_SUFFIX } from '../../../agent/domain/constants/agent.constants';
import { AI_PROVIDERS } from '../../../ai/domain/constants/ai.constants';
import { START_FILE_PREFIX } from './fileqa.constants';

/** `START_<name>_<provider>[_<model>].<ext>`; the provider group lists every servable provider. */
export const FILE_PATTERN = new RegExp(`^${START_FILE_PREFIX}(.+)_(${AI_PROVIDERS.join('|')})(?:_(.+))?(\\.[^.]+)$`, 'i');

/** `_agent` right before the extension opts the file into agent mode. */
export const AGENT_MARKER = new RegExp(`${AGENT_FILE_SUFFIX}(\\.[^.]+)$`, 'i');
