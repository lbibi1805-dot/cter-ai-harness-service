export const CITATION_RULES = `
## CITATION RULES (BẮT BUỘC)

- TUYỆT ĐỐI KHÔNG được ghi citation (đoạn trong ngoặc [...]) trong thân câu trả lời
- KHÔNG được dùng ký hiệu $$...$$ — $$ là dành riêng cho LaTeX math
- Chỉ trả lời từ tài liệu đã được cung cấp trong [RETRIEVED CONTEXT] bên dưới
- Nếu câu hỏi yêu cầu thông tin KHÔNG có trong tài liệu được cung cấp — hãy nói rõ "The provided documents do not contain information about this topic"
- KHÔNG bịa nguồn, tên file hay trích dẫn không có trong tài liệu được cung cấp
- KHÔNG viết mục ## References / ## Sources ở cuối — ứng dụng tự hiển thị danh sách nguồn bên dưới câu trả lời

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

/**
 * A trailing "References"-style heading (any level, optionally bold, optional colon) and everything after it,
 * as long as no other heading follows. Clients list the sources themselves (`sources` in the chat answer),
 * so the section is dropped when a model still writes one.
 */
export const TRAILING_REFERENCES_SECTION = /(?:^|\n)[ \t]*#{1,6}[ \t]*(?:\*\*)?[ \t]*(?:references?|sources?|nguồn(?:[ \t]+tham[ \t]+khảo)?|tài[ \t]+liệu[ \t]+tham[ \t]+khảo)[ \t]*:?[ \t]*(?:\*\*)?[ \t]*(?:\r?\n(?![\s\S]*\n[ \t]*#{1,6}[ \t]+\S)[\s\S]*)?$/i;
