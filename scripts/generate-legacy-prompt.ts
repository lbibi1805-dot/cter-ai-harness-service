// Writes system-prompt.md from the prompt registry (12/11 02 Bước 5): the rollback copy used when
// PROMPT_REGISTRY_ENABLED=false. Never edit system-prompt.md by hand: change prompts/*.md, then run `npm run prompts:legacy`.
// `--check` exits 1 when the file is out of date (CI / pre-commit).
import * as fs from 'fs';
import * as path from 'path';
import { legacyPromptInSync, legacyPromptText } from '../src/bootstrap/startup/legacyPrompt';
import { SYSTEM_PROMPT_FILE } from '../src/bootstrap/constants/bootstrap.constants';
import { createPromptRegistry } from '../src/modules/prompts';

const ROOT = path.resolve(__dirname, '..');
process.chdir(ROOT);
const registry = createPromptRegistry(path.join(ROOT, 'prompts'));
if (process.argv.includes('--check')) {
  const ok = legacyPromptInSync(registry.systemPrompt);
  console.log(ok ? `${SYSTEM_PROMPT_FILE} is in sync (promptVersion ${registry.promptVersion})` : `${SYSTEM_PROMPT_FILE} is OUT OF DATE: run npm run prompts:legacy`);
  if (!ok) process.exitCode = 1;
} else {
  fs.writeFileSync(path.join(ROOT, SYSTEM_PROMPT_FILE), legacyPromptText(registry.systemPrompt));
  console.log(`wrote ${SYSTEM_PROMPT_FILE} from prompts/ (promptVersion ${registry.promptVersion})`);
}
