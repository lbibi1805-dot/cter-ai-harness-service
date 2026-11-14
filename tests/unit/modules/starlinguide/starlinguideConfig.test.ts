import { describe, it, expect, afterEach } from 'vitest';
import { readStarlinguideConfig } from '../../../../src/bootstrap/config/readers/starlinguideConfig.reader';
import { publicConfigView } from '../../../../src/bootstrap/startup/configurationReport';
import type { AppConfig } from '../../../../src/bootstrap/interfaces/appConfig.interface';

const NAMES = ['STARLINGUIDE_API_BASE_URL', 'STARLINGUIDE_PARTNER_SECRET', 'STARLINGUIDE_EMAILS', 'STARLINGUIDE_FLUSH_DELAY_MS', 'STARLINGUIDE_TIMEOUT_MS'];

function env(values: Record<string, string>) {
  for (const name of NAMES) delete process.env[name];
  Object.assign(process.env, values);
}
afterEach(() => env({}));

const ON = { STARLINGUIDE_API_BASE_URL: 'https://api.test/uat/', STARLINGUIDE_PARTNER_SECRET: 's3cret', STARLINGUIDE_EMAILS: 'a@x.com, B@x.com' };

describe('readStarlinguideConfig (U10)', () => {
  it('off when the base URL is unset', () => {
    env({ STARLINGUIDE_PARTNER_SECRET: 's', STARLINGUIDE_EMAILS: 'a@x.com' });
    expect(readStarlinguideConfig()).toBeUndefined();
  });

  it('on: trailing slash dropped, defaults applied', () => {
    env(ON);
    expect(readStarlinguideConfig()).toEqual({ baseUrl: 'https://api.test/uat', secret: 's3cret', emails: ['a@x.com', 'B@x.com'], flushDelayMs: 5000, timeoutMs: 120000 });
  });

  it('half-configured or out of range = startup error', () => {
    env({ ...ON, STARLINGUIDE_PARTNER_SECRET: '' });
    expect(() => readStarlinguideConfig()).toThrow(/STARLINGUIDE_PARTNER_SECRET is missing/);
    env({ ...ON, STARLINGUIDE_EMAILS: ' ' });
    expect(() => readStarlinguideConfig()).toThrow(/STARLINGUIDE_EMAILS is missing/);
    env({ ...ON, STARLINGUIDE_EMAILS: 'not-an-email' });
    expect(() => readStarlinguideConfig()).toThrow(/STARLINGUIDE_EMAILS/);
    env({ ...ON, STARLINGUIDE_API_BASE_URL: 'ftp://x' });
    expect(() => readStarlinguideConfig()).toThrow(/https/);
    env({ ...ON, STARLINGUIDE_FLUSH_DELAY_MS: '10' });
    expect(() => readStarlinguideConfig()).toThrow(/STARLINGUIDE_FLUSH_DELAY_MS/);
  });

  it('GET /api/config shows host and counts, never the secret or the emails', () => {
    env(ON);
    const view = publicConfigView({ starlinguide: readStarlinguideConfig() } as unknown as AppConfig);
    expect(view).toMatchObject({ STARLINGUIDE_ENABLED: true, STARLINGUIDE_HOST: 'api.test', STARLINGUIDE_EMAIL_COUNT: 2 });
    expect(JSON.stringify(view)).not.toMatch(/s3cret|a@x\.com/);
  });
});
