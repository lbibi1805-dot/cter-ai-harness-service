import { describe, expect, it } from 'vitest';
import { toC4SketchRequest } from '../../../../../src/modules/c4/presentation/mappers/c4.mapper';

// 1x1 PNG: enough for parseImages (magic bytes are not checked on inline images).
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const body = (n: number) => ({ provider: 'openai', description: 'x', images: Array.from({ length: n }, () => ({ data: PNG, mimeType: 'image/png' })) });

describe('POST /api/c4 image limit (plan 14/11-05 giai đoạn 2)', () => {
  it('keeps the old default of 10 when no limit is passed', () => {
    expect(toC4SketchRequest(body(10)).images).toHaveLength(10);
    expect(() => toC4SketchRequest(body(11))).toThrow(/At most 10 images/);
  });

  it('follows MAX_CHAT_IMAGES when configured (20)', () => {
    expect(toC4SketchRequest(body(20), 20).images).toHaveLength(20);
    expect(() => toC4SketchRequest(body(21), 20)).toThrow(/At most 20 images/);
  });
});
