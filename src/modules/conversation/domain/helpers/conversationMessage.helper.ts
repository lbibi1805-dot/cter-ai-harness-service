import { HeaderBlock } from '../interfaces/conversationMessage.interface';

/** Parses `key: value` lines after the marker line, up to the first blank line. */
export function parseHeaderBlock(body: string): HeaderBlock {
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  const headers: Record<string, string> = {};
  let contentStart = lines.length;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') {
      contentStart = i + 1;
      break;
    }
    const separator = line.indexOf(':');
    if (separator === -1) continue;
    headers[line.slice(0, separator).trim().toLowerCase()] = line.slice(separator + 1).trim();
  }
  return { headers, content: lines.slice(contentStart).join('\n').trim() };
}
