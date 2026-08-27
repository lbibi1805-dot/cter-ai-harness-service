// ── Math delimiter normalization ─────────────────────────────────────────────
// Shared between the DOCX renderer and the PDF renderer so both produce
// consistent `$...$` / `$$...$$` LaTeX input.

export function normalizeMathDelimiters(text: string): string {
  let result = '';
  let i = 0;

  // Characters that indicate ( or [ is part of a LaTeX expression, not a math delimiter
  const LATEX_CONTEXT = /[\\{}\w$]/;

  while (i < text.length) {
    // Preserve existing $$...$$ untouched (check before single $)
    if (text.startsWith('$$', i)) {
      const end = text.indexOf('$$', i + 2);
      if (end !== -1) { result += text.slice(i, end + 2); i = end + 2; continue; }
    }

    // Preserve existing $...$ — also inject spaces when AI omits them (e.g. "where$a")
    if (text[i] === '$') {
      const end = text.indexOf('$', i + 1);
      if (end !== -1) {
        if (result.length > 0 && /\w/.test(result[result.length - 1])) result += ' ';
        result += text.slice(i, end + 1);
        i = end + 1;
        if (i < text.length && /\w/.test(text[i])) result += ' ';
        continue;
      }
    }

    // \[...\] → $$...$$
    if (text.startsWith('\\[', i)) {
      const end = text.indexOf('\\]', i + 2);
      if (end !== -1) { result += `$$${text.slice(i + 2, end)}$$`; i = end + 2; continue; }
    }

    // \(...\) → $...$
    if (text.startsWith('\\(', i)) {
      const end = text.indexOf('\\)', i + 2);
      if (end !== -1) { result += `$${text.slice(i + 2, end)}$`; i = end + 2; continue; }
    }

    // \begin{...}...\end{...} → $$...$$
    // align / align* / gather / multline: split on \\ rows, strip & alignment markers
    if (text.startsWith('\\begin{', i)) {
      const envClose = text.indexOf('}', i + 7);
      if (envClose !== -1) {
        const envName = text.slice(i + 7, envClose);
        const endTag = `\\end{${envName}}`;
        const end = text.indexOf(endTag, envClose + 1);
        if (end !== -1) {
          const content = text.slice(envClose + 1, end).trim();
          if (/^(align|gather|multline|eqnarray)/.test(envName)) {
            result += content
              .split(/\\\\/)
              .map(row => `$$${row.replace(/&/g, '').trim()}$$`)
              .filter(row => row !== '$$$$')
              .join('\n');
          } else {
            result += `$$${content}$$`;
          }
          i = end + endTag.length;
          continue;
        }
      }
    }

    // Bare \command{...} (not inside math delimiters) → $...$
    // Matches LaTeX like \text{...} that AI outputs without wrapping $...$
    if (text[i] === '\\' && /[a-zA-Z]/.test(text[i + 1] ?? '')) {
      const cmdStart = i + 1;
      let cmdEnd = cmdStart;
      while (/[a-zA-Z]/.test(text[cmdEnd] ?? '')) cmdEnd++;
      if (text[cmdEnd] === '{') {
        let depth = 0;
        let braceEnd = cmdEnd;
        for (; braceEnd < text.length; braceEnd++) {
          if (text[braceEnd] === '{') depth++;
          if (text[braceEnd] === '}') { depth--; if (depth === 0) break; }
        }
        if (depth === 0) {
          const expr = text.slice(i, braceEnd + 1);
          // Scan ahead for more inline LaTeX (numbers, =, operators) after the command
          let restEnd = braceEnd + 1;
          while (restEnd < text.length && /[\s\d+\-*/=,.]/.test(text[restEnd])) restEnd++;
          const fullExpr = text.slice(i, restEnd);
          result += `$${fullExpr}$`;
          i = restEnd;
          continue;
        }
      }
    }

    // [...LaTeX...] → $$...$$ — only when [ is NOT preceded by \, {, }, \w, $
    if (text[i] === '[' && !LATEX_CONTEXT.test(text[i - 1] ?? ' ')) {
      const end = text.indexOf(']', i + 1);
      if (end !== -1) {
        const content = text.slice(i + 1, end);
        // Skip conversion if content looks like a file citation (contains .md, §, or Windows path)
        const looksLikeCitation = /\.md\b|§|\.docx?\b|\.pdf\b|\\[A-Z]/.test(content);
        if (/\\[a-zA-Z]/.test(content) && !looksLikeCitation) { result += `$$${content}$$`; i = end + 1; continue; }
      }
    }

    // (...LaTeX...) → $...$ — only when ( is NOT preceded by \, {, }, \w, $
    if (text[i] === '(' && !LATEX_CONTEXT.test(text[i - 1] ?? ' ')) {
      const end = text.indexOf(')', i + 1);
      if (end !== -1) {
        const content = text.slice(i + 1, end);
        const looksLikeCitation = /\.(?:md|docx?|pdf)\b|§|\\[A-Z]/.test(content);
        if (/\\[a-zA-Z]/.test(content) && !looksLikeCitation) { result += `$${content}$`; i = end + 1; continue; }
      }
    }

    result += text[i];
    i += 1;
  }

  return result;
}