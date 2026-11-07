import { splitCodeSegments } from './codeSegments';
import { MERMAID_INFO } from './constants/codeSegments.constants';
import { MERMAID_EDGE, MERMAID_NODE, MERMAID_STRAY_GLYPH } from './constants/mermaidSanitizer.constants';
import { TextSegmentKind } from './enums/text.enums';

/**
 * Fixes the source of one Mermaid diagram.
 * Auto-fix cho gemini-flash-lite hay nhả raw glyph ngoài label -> Syntax error mermaid 11.17.2.
 * Chi sua dong stray, KHONG cham vao dong da dung cua openai/gpt-5.
 */
export function sanitizeMermaidSource(source: string): string {
  const fixedLines = source.split('\n').map((line) => {
    const hasGlyph = MERMAID_STRAY_GLYPH.test(line);
    const hasEdge = MERMAID_EDGE.test(line);
    const hasNode = MERMAID_NODE.test(line);
    // Dong stray: chua glyph nhung khong co edge/node -> xoa (gemini hay de "δl" rieng dong)
    // Giu lai dong cua openai vi co edge (-- "..." -->)
    if (hasGlyph && !hasEdge && !hasNode) return '';
    // Thay raw δ_l, ℓ_v trong label thanh HTML-safe - chi khi chua co <sub>
    let out = line;
    if (!out.includes('<sub>')) {
      out = out.replace(/δ\s*_\s*l/g, 'δ<sub>l</sub>').replace(/δl/g, 'δ<sub>l</sub>');
      out = out.replace(/ℓ\s*_\s*v/g, 'ℓ<sub>v</sub>').replace(/ℓv/g, 'ℓ<sub>v</sub>');
    }
    return out;
  });
  // Dam bao khong de 3 dong trong lien tiep gay loi
  return fixedLines.join('\n').replace(/\n{3,}/g, '\n\n');
}

/** PDF path (historical behaviour): every "```mermaid … ```" span of the Markdown. */
export function sanitizeMermaidGlyphs(body: string): string {
  return body.replace(/```mermaid([\s\S]*?)```/g, (_match, inner: string) => '```mermaid' + sanitizeMermaidSource(inner) + '```');
}

/** Sanitizes only the body of real ```mermaid fenced blocks (fence lines and other text untouched). */
export function sanitizeMermaidFences(text: string): string {
  return splitCodeSegments(text)
    .map(({ kind, text: segmentText, fence }) => {
      if (kind !== TextSegmentKind.FENCED_CODE || !fence) return segmentText;
      if (fence.info.split(/\s+/)[0].toLowerCase() !== MERMAID_INFO) return segmentText;
      return fence.open + sanitizeMermaidSource(fence.body) + fence.close;
    })
    .join('');
}
