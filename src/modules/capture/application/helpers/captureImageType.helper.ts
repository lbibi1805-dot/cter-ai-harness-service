import { CaptureMimeType } from '../../domain';

const SIGNATURES: ReadonlyArray<{ mimeType: CaptureMimeType; test: (b: Buffer) => boolean }> = [
  { mimeType: CaptureMimeType.JPEG, test: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mimeType: CaptureMimeType.PNG, test: (b) => b.length > 8 && b.readUInt32BE(0) === 0x89504e47 && b.readUInt32BE(4) === 0x0d0a1a0a },
  { mimeType: CaptureMimeType.GIF, test: (b) => b.length > 6 && b.toString('ascii', 0, 4) === 'GIF8' },
  { mimeType: CaptureMimeType.WEBP, test: (b) => b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' },
];

/** The real type from the magic bytes (the declared Content-Type is not trusted); null = not a supported image. */
export function sniffCaptureImage(body: Buffer): CaptureMimeType | null {
  return SIGNATURES.find((s) => s.test(body))?.mimeType ?? null;
}
