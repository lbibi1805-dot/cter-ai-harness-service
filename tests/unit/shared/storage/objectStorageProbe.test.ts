import { describe, it, expect } from 'vitest';
import { probeObjectStorage } from '../../../../src/shared/storage';
import { FakeObjectStorage } from '../../../support/countingAdapters';

describe('probeObjectStorage (GET /api/storage/check)', () => {
  it('put → head → delete under tmp/, leaves nothing behind', async () => {
    const storage = new FakeObjectStorage();
    const probe = await probeObjectStorage(storage);
    expect(probe).toMatchObject({ ok: true, kind: storage.kind, location: storage.location });
    expect(storage.faults.count('put')).toBe(1);
    expect(storage.faults.count('head')).toBe(1);
    expect(storage.faults.count('delete')).toBe(1);
    expect(storage.objects.size).toBe(0);
  });

  it.each(['put', 'head', 'delete'] as const)('reports the failing step (%s) instead of throwing', async (step) => {
    const storage = new FakeObjectStorage();
    storage.faults.failNext(step);
    const probe = await probeObjectStorage(storage);
    expect(probe).toMatchObject({ ok: false, failedStep: step, error: `injected ${step} failure` });
  });
});
