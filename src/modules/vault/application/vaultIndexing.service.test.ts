import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ReindexOutcome } from '../domain';
import { AUTO_INDEX_DEBOUNCE_MS, VaultIndexingService } from './vaultIndexing.service';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => { resolve = r; });
  return { promise, resolve };
}

describe('VaultIndexingService', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('reports NOT_CONFIGURED without an indexer', () => {
    expect(new VaultIndexingService(null).requestManualReindex()).toBe(ReindexOutcome.NOT_CONFIGURED);
  });

  it('starts a manual run and rejects a second one while running', async () => {
    const run = deferred();
    const indexAll = vi.fn(() => run.promise);
    const service = new VaultIndexingService(() => ({ indexAll }));

    expect(service.requestManualReindex()).toBe(ReindexOutcome.STARTED);
    expect(service.isIndexing()).toBe(true);
    expect(service.requestManualReindex()).toBe(ReindexOutcome.ALREADY_RUNNING);

    run.resolve();
    await vi.runAllTimersAsync();
    expect(service.isIndexing()).toBe(false);
    expect(indexAll).toHaveBeenCalledTimes(1);
  });

  it('debounces uploads into a single run', async () => {
    const indexAll = vi.fn().mockResolvedValue(undefined);
    const service = new VaultIndexingService(() => ({ indexAll }));
    service.scheduleAfterUpload();
    service.scheduleAfterUpload();
    await vi.advanceTimersByTimeAsync(AUTO_INDEX_DEBOUNCE_MS);
    expect(indexAll).toHaveBeenCalledTimes(1);
  });

  it('reruns once when an upload lands during a run', async () => {
    const first = deferred();
    const indexAll = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue(undefined);
    const service = new VaultIndexingService(() => ({ indexAll }));

    service.requestManualReindex();
    service.scheduleAfterUpload();
    await vi.advanceTimersByTimeAsync(AUTO_INDEX_DEBOUNCE_MS);
    expect(indexAll).toHaveBeenCalledTimes(1);

    first.resolve();
    await vi.advanceTimersByTimeAsync(AUTO_INDEX_DEBOUNCE_MS);
    expect(indexAll).toHaveBeenCalledTimes(2);
  });

  it('runNow rethrows and releases the lock', async () => {
    const service = new VaultIndexingService(() => ({ indexAll: vi.fn().mockRejectedValue(new Error('no key')) }));
    await expect(service.runNow()).rejects.toThrow('no key');
    expect(service.isIndexing()).toBe(false);
  });
});
