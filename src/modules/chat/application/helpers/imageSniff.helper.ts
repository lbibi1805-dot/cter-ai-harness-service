import type { SniffedImage } from '../interfaces/stagedImages.interface';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function pngSize(b: Buffer): SniffedImage {
  return { mimeType: 'image/png', ...(b.length >= 24 ? { width: b.readUInt32BE(16), height: b.readUInt32BE(20) } : {}) };
}

function gifSize(b: Buffer): SniffedImage {
  return { mimeType: 'image/gif', ...(b.length >= 10 ? { width: b.readUInt16LE(6), height: b.readUInt16LE(8) } : {}) };
}

function webpSize(b: Buffer): SniffedImage {
  const chunk = b.toString('ascii', 12, 16);
  if (chunk === 'VP8 ' && b.length >= 30) return { mimeType: 'image/webp', width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
  if (chunk === 'VP8L' && b.length >= 25) {
    const bits = b.readUInt32LE(21);
    return { mimeType: 'image/webp', width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (chunk === 'VP8X' && b.length >= 30) return { mimeType: 'image/webp', width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
  return { mimeType: 'image/webp' };
}

/** JPEG: walk the markers to the first SOFn frame header (height, width). */
function jpegSize(b: Buffer): SniffedImage {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const marker = b[i + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0xff) { i += marker === 0xff ? 1 : 2; continue; }
    const length = b.readUInt16BE(i + 2);
    const isFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isFrame) return { mimeType: 'image/jpeg', height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
    i += 2 + length;
  }
  return { mimeType: 'image/jpeg' };
}

/**
 * The real type of an uploaded image from its magic bytes (PNG, JPEG, GIF, WebP — what every provider takes),
 * with its size when the header has it. Null = not one of those (the declared Content-Type is never trusted).
 */
export function sniffImage(b: Buffer): SniffedImage | null {
  if (b.length >= 8 && b.subarray(0, 8).equals(PNG_SIGNATURE)) return pngSize(b);
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return jpegSize(b);
  if (b.length >= 6 && (b.toString('ascii', 0, 6) === 'GIF87a' || b.toString('ascii', 0, 6) === 'GIF89a')) return gifSize(b);
  if (b.length >= 16 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return webpSize(b);
  return null;
}
