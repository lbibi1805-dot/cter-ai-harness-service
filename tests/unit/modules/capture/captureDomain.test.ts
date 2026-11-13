import { describe, it, expect } from 'vitest';
import { ValidationError } from '../../../../src/shared/errors';
import { assertValidKey } from '../../../../src/shared/storage';
import {
  CaptureCatalog,
  CaptureMimeType,
  batchPrefix,
  imageName,
  normalizeFolder,
  parseBatchIndex,
  parseCaptureKey,
} from '../../../../src/modules/capture/domain';

describe('capture keys', () => {
  it('normalizes the folder typed on the phone', () => {
    expect(normalizeFolder('Bách Lê')).toBe('bach-le');
    expect(normalizeFolder('  Đức_01 ')).toBe('duc_01');
    for (const bad of ['', '   ', '!!!', 42, undefined]) expect(() => normalizeFolder(bad), String(bad)).toThrow(ValidationError);
  });

  it('accepts batch indexes 1–9999 only', () => {
    expect(parseBatchIndex('7')).toBe(7);
    expect(parseBatchIndex(12)).toBe(12);
    for (const bad of ['0', '-1', '10000', 'abc', '1.5', '']) expect(() => parseBatchIndex(bad), bad).toThrow(ValidationError);
  });

  it('builds sortable keys under captures/ that the storage accepts and parses back', () => {
    const key = `${batchPrefix('bach', 7)}${imageName(3, 'a1b2c3', CaptureMimeType.JPEG)}`;
    expect(key).toBe('captures/bach/0007/03-a1b2c3.jpg');
    expect(() => assertValidKey(key)).not.toThrow();
    expect(parseCaptureKey(key)).toEqual({ folder: 'bach', index: 7, name: '03-a1b2c3.jpg', seq: 3, mimeType: CaptureMimeType.JPEG });
    for (const foreign of ['captures/bach/7/03-a1b2c3.jpg', 'captures/bach/0007/x.jpg', 'captures/Bach/0007/03-a1b2c3.jpg', 'vault/x/0001/01-aaaaaa.jpg', 'captures/bach/0000/01-aaaaaa.png']) {
      expect(parseCaptureKey(foreign), foreign).toBeNull();
    }
  });
});

describe('CaptureCatalog', () => {
  const image = (folder: string, index: number, seq: number, at: number) => {
    const name = imageName(seq, 'abcdef', CaptureMimeType.PNG);
    return { name, key: `${batchPrefix(folder, index)}${name}`, seq, mimeType: CaptureMimeType.PNG, bytes: 10, createdAt: at };
  };

  it('rebuilds folders and batches from one listing', () => {
    const catalog = new CaptureCatalog();
    const count = catalog.load([
      { key: 'captures/bach/0002/01-abcdef.jpg', size: 5, lastModified: new Date(2000) },
      { key: 'captures/bach/0002/02-abcdef.jpg', size: 6, lastModified: new Date(3000) },
      { key: 'captures/an/0001/01-abcdef.png', size: 7, lastModified: new Date(1000) },
      { key: 'captures/bach/README.txt', size: 1 },
    ], 0);
    expect(count).toBe(3);
    expect(catalog.summaries()).toEqual([
      { name: 'an', batchCount: 1, imageCount: 1, latestIndex: 1, updatedAt: 1000 },
      { name: 'bach', batchCount: 1, imageCount: 2, latestIndex: 2, updatedAt: 3000 },
    ]);
    expect(catalog.createBatch('bach', 5000).index).toBe(3);
  });

  it('never reuses a batch number after a delete, and hides empty batches', () => {
    const catalog = new CaptureCatalog();
    const first = catalog.createBatch('bach', 1);
    catalog.addImage('bach', first.index, image('bach', first.index, 1, 2));
    const second = catalog.createBatch('bach', 3);
    expect(second.index).toBe(2);
    expect(catalog.batches('bach').map((b) => b.index)).toEqual([1]);
    catalog.removeBatch('bach', 2);
    expect(catalog.createBatch('bach', 4).index).toBe(3);
  });

  it('reserves sequence numbers synchronously for parallel uploads', () => {
    const catalog = new CaptureCatalog();
    const batch = catalog.createBatch('bach', 1);
    const seqs = [1, 2, 3].map(() => catalog.reserveSeq('bach', batch.index));
    expect(seqs).toEqual([1, 2, 3]);
  });
});
