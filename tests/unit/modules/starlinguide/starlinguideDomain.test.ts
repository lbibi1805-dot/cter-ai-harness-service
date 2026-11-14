import { describe, it, expect } from 'vitest';
import {
  PairOutcome,
  classifyResult,
  fillsRequest,
  isLibraryFull,
  isTooLargeForPartner,
  maskEmail,
  parseEmails,
  partnerFileName,
  planBatches,
} from '../../../../src/modules/starlinguide';

const MB = 1024 * 1024;

describe('starlinguide domain', () => {
  it('parseEmails: separators, trim, exact dedupe, case kept (U1)', () => {
    expect(parseEmails(' a@x.com, Alice@x.com;alice@x.com\nb@y.vn ,a@x.com ')).toEqual(['a@x.com', 'Alice@x.com', 'alice@x.com', 'b@y.vn']);
  });

  it('parseEmails: rejects empty, > 20 and malformed (masked in the message)', () => {
    expect(() => parseEmails(' , ;')).toThrow(/at least one/);
    expect(() => parseEmails(Array.from({ length: 21 }, (_, i) => `u${i}@x.com`).join(','))).toThrow(/at most 20/);
    expect(() => parseEmails('ok@x.com, secret-person@nodot')).toThrow(/s\*\*\*@nodot/);
  });

  it('maskEmail hides the local part', () => {
    expect(maskEmail('alice@example.com')).toBe('a***@example.com');
    expect(maskEmail('broken')).toBe('***');
  });

  it('partnerFileName = folder-index(4)-seq(2).ext (U3)', () => {
    expect(partnerFileName({ folder: 'bach', index: 7, seq: 3, name: '03-a1b2c3.jpg' })).toBe('bach-0007-03.jpg');
    expect(partnerFileName({ folder: 'lan', index: 12, seq: 101, name: '101-abcdef.png' })).toBe('lan-0012-101.png');
  });

  it('planBatches: ≤ 20 files and ≤ 28 MB per request, order kept (U2)', () => {
    const small = Array.from({ length: 25 }, (_, i) => ({ id: i, bytes: 100 }));
    expect(planBatches(small).map((b) => b.length)).toEqual([20, 5]);
    const big = [{ id: 1, bytes: 12 * MB }, { id: 2, bytes: 12 * MB }, { id: 3, bytes: 12 * MB }];
    expect(planBatches(big).map((b) => b.map((x) => x.id))).toEqual([[1, 2], [3]]);
    expect(fillsRequest(Array.from({ length: 20 }, () => ({ bytes: 1 })))).toBe(true);
    expect(fillsRequest([{ bytes: 29 * MB }])).toBe(true);
    expect(fillsRequest([{ bytes: MB }])).toBe(false);
  });

  it('only INTERNAL_SERVER_ERROR (or a missing result) is retried', () => {
    expect(classifyResult(undefined)).toBe(PairOutcome.SUCCESS);
    expect(classifyResult('INTERNAL_SERVER_ERROR')).toBe(PairOutcome.RETRY);
    expect(classifyResult('MISSING_RESULT')).toBe(PairOutcome.RETRY);
    for (const code of ['RESOURCE_NOT_FOUND', 'INVALID_FILE_TYPE', 'CONTEXT_FILE_LIMIT', 'STORAGE_QUOTA_EXCEEDED', 'INVALID_VALIDATION']) {
      expect(classifyResult(code)).toBe(PairOutcome.PERMANENT);
    }
    expect(isLibraryFull('CONTEXT_FILE_LIMIT')).toBe(true);
    expect(isLibraryFull('RESOURCE_NOT_FOUND')).toBe(false);
    expect(isTooLargeForPartner(20 * MB)).toBe(false);
    expect(isTooLargeForPartner(20 * MB + 1)).toBe(true);
  });
});
