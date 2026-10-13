import { describe, it, expect } from 'vitest';
import { advanceWatermark } from './watermark';

const t = (iso: string) => new Date(`2026-10-01T${iso}Z`);

describe('advanceWatermark', () => {
  it('moves to the newest item when everything settled', () => {
    expect(advanceWatermark([{ updatedAt: t('10:00:00'), settled: true }, { updatedAt: t('10:05:00'), settled: true }], null))
      .toEqual(t('10:05:00'));
  });

  it('stops right before the oldest unsettled item, regardless of input order', () => {
    const items = [
      { updatedAt: t('10:10:00'), settled: true },
      { updatedAt: t('10:05:00'), settled: false },
      { updatedAt: t('10:00:00'), settled: true },
    ];
    expect(advanceWatermark(items, null)).toEqual(t('10:00:00'));
  });

  it('keeps the current cursor when the oldest item is unsettled', () => {
    expect(advanceWatermark([{ updatedAt: t('10:05:00'), settled: false }], t('09:00:00'))).toEqual(t('09:00:00'));
  });

  it('keeps the current cursor when nothing was listed', () => {
    expect(advanceWatermark([], t('09:00:00'))).toEqual(t('09:00:00'));
    expect(advanceWatermark([], null)).toBeNull();
  });

  it('never moves backwards', () => {
    expect(advanceWatermark([{ updatedAt: t('08:00:00'), settled: true }], t('09:00:00'))).toEqual(t('09:00:00'));
  });
});
