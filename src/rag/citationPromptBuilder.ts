import type { CitedChunk, CitationResult } from '../types';

const CITATION_RULES = `
## CITATION RULES (BẮT BUỘC)

- TUYỆT ĐỐI KHÔNG được ghi citation (đoạn trong ngoặc [...]) trong thân câu trả lời
- KHÔNG được dùng ký hiệu $$...$$ — $$ là dành riêng cho LaTeX math
- Chỉ trả lời từ tài liệu đã được cung cấp trong [RETRIEVED CONTEXT] bên dưới
- Nếu câu hỏi yêu cầu thông tin KHÔNG có trong tài liệu được cung cấp — hãy nói rõ "The provided documents do not contain information about this topic"
- Kết thúc câu trả lời bằng ## References section liệt kê tất cả nguồn đã dùng (chỉ tên file, không ghi số trang/heading)
`.trim();

export class CitationPromptBuilder {
  build(
    baseSystemPrompt: string,
    chunks: CitedChunk[],
    fileContent: string,
  ): CitationResult {
    const systemPrompt = `${baseSystemPrompt}\n\n${CITATION_RULES}`;
    const contextBlock = this.formatContext(chunks);
    const userContent = contextBlock
      ? `${contextBlock}\n\n${fileContent}`
      : fileContent;

    return { systemPrompt, userContent };
  }

  private formatContext(chunks: CitedChunk[]): string {
    if (chunks.length === 0) return '';

    const separator = '\n' + '─'.repeat(46) + '\n';
    const parts = chunks.map((c, i) => {
      const sourceLabel = `SOURCE [${i + 1}]: ${c.source} > ${c.heading}`;
      const scoreLine = c.score !== undefined
        ? `(relevance: ${(c.score * 100).toFixed(0)}%)`
        : '';
      return [
        `📄 ${sourceLabel}${scoreLine ? ' ' + scoreLine : ''}`,
        separator.trimEnd(),
        c.text,
      ].join('\n');
    });

    return `[RETRIEVED CONTEXT]\n${parts.join('\n\n')}\n[/RETRIEVED CONTEXT]`;
  }

  static cleanResponse(response: string): string {
    return response
      .replace(/\$\$(.+?\.md.+?)\$\$/gi, (_, c) => c.trim())
      .replace(/\$\$([^$]*?\.[a-zA-Z]{2,}[^$]*?)\$\$/g, (_, c) => c.trim());
  }
}
