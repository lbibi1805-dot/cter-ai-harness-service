// Real Chromium: reproduces the production failure where an OOM-killed browser
// broke every later render until restart. Set SKIP_BROWSER_TESTS=1 to skip.
import { describe, it, expect, afterAll } from 'vitest';
import { closeBrowser, getBrowser, markdownToPdf } from './markdownToPdf';

const PDF_MAGIC = '%PDF';

describe.skipIf(process.env.SKIP_BROWSER_TESTS === '1')('markdownToPdf browser recovery', () => {
  afterAll(() => closeBrowser());

  it('renders again after Chromium is killed', async () => {
    const first = await markdownToPdf('T', {}, '# before crash');
    expect(first.buffer.subarray(0, 4).toString()).toBe(PDF_MAGIC);

    const crashed = await getBrowser();
    crashed.process()?.kill('SIGKILL');
    await new Promise((resolve) => crashed.once('disconnected', resolve));

    const second = await markdownToPdf('T', {}, '# after crash');
    expect(second.buffer.subarray(0, 4).toString()).toBe(PDF_MAGIC);

    const replacement = await getBrowser();
    expect(replacement).not.toBe(crashed);
    expect(replacement.connected).toBe(true);
  }, 60_000);

  it('reuses the same browser while it is healthy', async () => {
    expect(await getBrowser()).toBe(await getBrowser());
  }, 60_000);
});
