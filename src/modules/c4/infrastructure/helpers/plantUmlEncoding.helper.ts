import { constants as zlibConstants, deflateRawSync, inflateRawSync } from 'zlib';
import { PLANTUML_ALPHABET } from '../constants/plantUml.constants';

/**
 * PlantUML server text encoding: raw DEFLATE + PlantUML's 6-bit alphabet (0-9A-Za-z-_), the scheme of the
 * plantuml-encoder package used by c4-plantuml-mcp-server.
 */
export function encodePlantUml(source: string): string {
  const data = deflateRawSync(Buffer.from(source, 'utf8'), { level: zlibConstants.Z_BEST_COMPRESSION });
  let encoded = '';
  for (let i = 0; i < data.length; i += 3) {
    const b1 = data[i];
    const b2 = i + 1 < data.length ? data[i + 1] : 0;
    const b3 = i + 2 < data.length ? data[i + 2] : 0;
    encoded += PLANTUML_ALPHABET[b1 >> 2];
    encoded += PLANTUML_ALPHABET[((b1 & 0x3) << 4) | (b2 >> 4)];
    encoded += PLANTUML_ALPHABET[((b2 & 0xf) << 2) | (b3 >> 6)];
    encoded += PLANTUML_ALPHABET[b3 & 0x3f];
  }
  return encoded;
}

/** Inverse of encodePlantUml (tests, debugging saved URLs). */
export function decodePlantUml(encoded: string): string {
  const bytes: number[] = [];
  for (let i = 0; i + 3 < encoded.length; i += 4) {
    const [c1, c2, c3, c4] = [0, 1, 2, 3].map((k) => PLANTUML_ALPHABET.indexOf(encoded[i + k]));
    bytes.push((c1 << 2) | (c2 >> 4), ((c2 & 0xf) << 4) | (c3 >> 2), ((c3 & 0x3) << 6) | c4);
  }
  // Zero padding after the end of the DEFLATE stream is ignored.
  return inflateRawSync(Buffer.from(bytes), { finishFlush: zlibConstants.Z_SYNC_FLUSH }).toString('utf8');
}
