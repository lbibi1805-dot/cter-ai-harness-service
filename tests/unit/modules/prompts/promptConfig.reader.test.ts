import { describe, it, expect, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { readPromptConfig } from '../../../../src/bootstrap/config/readers/promptConfig.reader';

describe('readPromptConfig', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('uses the prompts/ registry by default when prompts/core/system.md exists', () => {
    vi.stubEnv('PROMPT_REGISTRY_ENABLED', '');
    vi.stubEnv('PROMPTS_DIR', '');
    const config = readPromptConfig();
    expect(config.registry).not.toBeNull();
    expect(config.systemPrompt).toBe(config.registry!.systemPrompt);
    expect(config.promptVersion).toBe(config.registry!.promptVersion);
  });

  it('falls back to system-prompt.md when the registry is disabled', () => {
    vi.stubEnv('PROMPT_REGISTRY_ENABLED', 'false');
    const config = readPromptConfig();
    expect(config.registry).toBeNull();
    expect(config.systemPrompt).toBe(fs.readFileSync(path.resolve('system-prompt.md'), 'utf-8').trim());
    expect(config.promptVersion).toMatch(/^[0-9a-f]{12}$/);
  });

  it('falls back to system-prompt.md when PROMPTS_DIR has no registry, and fails when it is forced on', () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'prompts-'));
    try {
      vi.stubEnv('PROMPTS_DIR', empty);
      vi.stubEnv('PROMPT_REGISTRY_ENABLED', '');
      expect(readPromptConfig().registry).toBeNull();
      vi.stubEnv('PROMPT_REGISTRY_ENABLED', 'true');
      expect(() => readPromptConfig()).toThrow(/core\/system\.md/);
    } finally {
      fs.rmSync(empty, { recursive: true, force: true });
    }
  });
});
