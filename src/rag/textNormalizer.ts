export function normalizeText(text: string): string {
  return text.replace(/[\u{1D400}-\u{1D7FF}]/gu, mapMathChar);
}

function mapMathChar(char: string): string {
  const code = char.codePointAt(0)!;
  if (code < 0x1D400 || code > 0x1D7FF) return char;

  // Mathematical Bold: A-Z (U+1D400-U+1D419), a-z (U+1D41A-U+1D433)
  if (code <= 0x1D433) {
    const offset = code - 0x1D400;
    if (offset < 26) return String.fromCharCode(0x41 + offset);
    return String.fromCharCode(0x61 + offset - 26);
  }

  // Mathematical Italic: A-Z (U+1D434-U+1D44D), a-z (U+1D44E-U+1D467)
  if (code <= 0x1D467) {
    const offset = code - 0x1D434;
    if (offset < 26) return String.fromCharCode(0x41 + offset);
    return String.fromCharCode(0x61 + offset - 26);
  }

  // Mathematical Bold Italic: A-Z (U+1D468-U+1D481), a-z (U+1D482-U+1D49B)
  if (code <= 0x1D49B) {
    const offset = code - 0x1D468;
    if (offset < 26) return String.fromCharCode(0x41 + offset);
    return String.fromCharCode(0x61 + offset - 26);
  }

  // Mathematical Script: scattered, handle common ones
  const scriptMap: Record<number, string> = {
    [0x1D49C]: 'A', [0x1D49E]: 'C', [0x1D49F]: 'D', [0x1D4A2]: 'G',
    [0x1D4A5]: 'J', [0x1D4A6]: 'K', [0x1D4A9]: 'N', [0x1D4AA]: 'O',
    [0x1D4AB]: 'P', [0x1D4AC]: 'Q', [0x1D4AE]: 'S', [0x1D4AF]: 'T',
    [0x1D4B0]: 'U', [0x1D4B1]: 'V', [0x1D4B2]: 'W', [0x1D4B3]: 'X',
    [0x1D4B4]: 'Y', [0x1D4B5]: 'Z',
    [0x1D4B6]: 'a', [0x1D4B7]: 'b', [0x1D4B8]: 'c', [0x1D4B9]: 'd',
    [0x1D4BB]: 'f', [0x1D4BD]: 'h', [0x1D4BE]: 'i', [0x1D4BF]: 'j',
    [0x1D4C0]: 'k', [0x1D4C1]: 'l', [0x1D4C2]: 'm', [0x1D4C3]: 'n',
    [0x1D4C5]: 'p', [0x1D4C6]: 'q', [0x1D4C7]: 'r', [0x1D4C8]: 's',
    [0x1D4C9]: 't', [0x1D4CA]: 'u', [0x1D4CB]: 'v', [0x1D4CC]: 'w',
    [0x1D4CD]: 'x', [0x1D4CE]: 'y', [0x1D4CF]: 'z',
  };
  if (code >= 0x1D49C && code <= 0x1D4CF && scriptMap[code]) {
    return scriptMap[code];
  }

  // Mathematical Bold Script: A-Z (U+1D4D0-U+1D4E9), a-z (U+1D4EA-U+1D503)
  if (code >= 0x1D4D0 && code <= 0x1D503) {
    const offset = code - 0x1D4D0;
    if (offset < 26) return String.fromCharCode(0x41 + offset);
    return String.fromCharCode(0x61 + offset - 26);
  }

  // Mathematical Fraktur: A-Z (U+1D504-U+1D51D), a-z (U+1D51E-U+1D537)
  if (code >= 0x1D504 && code <= 0x1D537) {
    const offset = code - 0x1D504;
    if (offset < 26) return String.fromCharCode(0x41 + offset);
    return String.fromCharCode(0x61 + offset - 26);
  }

  // Mathematical Double-Struck: A-Z (U+1D538-U+1D551), a-z (U+1D552-U+1D56B)
  if (code >= 0x1D538 && code <= 0x1D56B) {
    const offset = code - 0x1D538;
    if (offset < 26) return String.fromCharCode(0x41 + offset);
    return String.fromCharCode(0x61 + offset - 26);
  }

  // Mathematical Bold Fraktur: A-Z (U+1D56C-U+1D585), a-z (U+1D586-U+1D59F)
  if (code >= 0x1D56C && code <= 0x1D59F) {
    const offset = code - 0x1D56C;
    if (offset < 26) return String.fromCharCode(0x41 + offset);
    return String.fromCharCode(0x61 + offset - 26);
  }

  // Mathematical Sans-Serif: A-Z (U+1D5A0-U+1D5B9), a-z (U+1D5BA-U+1D5D3)
  if (code >= 0x1D5A0 && code <= 0x1D5D3) {
    const offset = code - 0x1D5A0;
    if (offset < 26) return String.fromCharCode(0x41 + offset);
    return String.fromCharCode(0x61 + offset - 26);
  }

  // Mathematical Sans-Serif Bold: A-Z (U+1D5D4-U+1D5ED), a-z (U+1D5EE-U+1D607)
  if (code >= 0x1D5D4 && code <= 0x1D607) {
    const offset = code - 0x1D5D4;
    if (offset < 26) return String.fromCharCode(0x41 + offset);
    return String.fromCharCode(0x61 + offset - 26);
  }

  // Mathematical Sans-Serif Italic: A-Z (U+1D608-U+1D621), a-z (U+1D622-U+1D63B)
  if (code >= 0x1D608 && code <= 0x1D63B) {
    const offset = code - 0x1D608;
    if (offset < 26) return String.fromCharCode(0x41 + offset);
    return String.fromCharCode(0x61 + offset - 26);
  }

  // Mathematical Sans-Serif Bold Italic: A-Z (U+1D63C-U+1D655), a-z (U+1D656-U+1D66F)
  if (code >= 0x1D63C && code <= 0x1D66F) {
    const offset = code - 0x1D63C;
    if (offset < 26) return String.fromCharCode(0x41 + offset);
    return String.fromCharCode(0x61 + offset - 26);
  }

  // Mathematical Monospace: A-Z (U+1D670-U+1D689), a-z (U+1D68A-U+1D6A3)
  if (code >= 0x1D670 && code <= 0x1D6A3) {
    const offset = code - 0x1D670;
    if (offset < 26) return String.fromCharCode(0x41 + offset);
    return String.fromCharCode(0x61 + offset - 26);
  }

  // Mathematical Italic digits: 0-9 (U+1D7CE-U+1D7D7)
  // Mathematical Bold digits: 0-9 (U+1D7D8-U+1D7E1)
  // Mathematical Double-Struck digits: 0-9 (U+1D7D8-U+1D7E1)
  // Mathematical Sans-Serif digits: 0-9 (U+1D7E2-U+1D7EB)
  // Mathematical Sans-Serif Bold digits: 0-9 (U+1D7EC-U+1D7F5)
  // Mathematical Monospace digits: 0-9 (U+1D7F6-U+1D7FF)
  if (code >= 0x1D7CE && code <= 0x1D7FF) {
    const digitSets = [
      [0x1D7CE, 0x1D7D7], [0x1D7D8, 0x1D7E1], [0x1D7E2, 0x1D7EB],
      [0x1D7EC, 0x1D7F5], [0x1D7F6, 0x1D7FF],
    ];
    for (const [start, end] of digitSets) {
      if (code >= start && code <= end) {
        return String.fromCharCode(0x30 + (code - start));
      }
    }
  }

  return char;
}
