export const CITATION_RULES = `
## CITATION RULES (BẮT BUỘC)

- TUYỆT ĐỐI KHÔNG được ghi citation (đoạn trong ngoặc [...]) trong thân câu trả lời
- KHÔNG được dùng ký hiệu $$...$$ — $$ là dành riêng cho LaTeX math
- Chỉ trả lời từ tài liệu đã được cung cấp trong [RETRIEVED CONTEXT] bên dưới
- Nếu câu hỏi yêu cầu thông tin KHÔNG có trong tài liệu được cung cấp — hãy nói rõ "The provided documents do not contain information about this topic"
- Kết thúc câu trả lời bằng ## References section liệt kê tất cả nguồn đã dùng (chỉ tên file, không ghi số trang/heading)

## CODE FORMATTING (BẮT BUỘC CHO QNX/C)
- Mọi code C/QNX phải trong fence \`\`\`c, mỗi statement 1 dòng, indent 2 spaces, không dồn \`;\`
- Ví dụ đúng: \`\`\`c\\n pthread_mutex_lock(&shared_mtx);\\n shared.key = c;\\n \`\`\`
`.trim();

export const CONTEXT_OPEN_TAG = '[RETRIEVED CONTEXT]';

export const CONTEXT_CLOSE_TAG = '[/RETRIEVED CONTEXT]';

export const SOURCE_SEPARATOR_WIDTH = 46;

/** Leading blank line kept: prompts must stay byte-identical to the evaluated baseline. */
export const SOURCE_SEPARATOR = `\n${'─'.repeat(SOURCE_SEPARATOR_WIDTH)}`;

export const PERCENT = 100;

/** Models sometimes wrap file citations in `$$…$$`, which then renders as broken LaTeX. */
export const DOLLAR_WRAPPED_MD_FILE = /\$\$(.+?\.md.+?)\$\$/gi;

export const DOLLAR_WRAPPED_FILE_NAME = /\$\$([^$]*?\.[a-zA-Z]{2,}[^$]*?)\$\$/g;
