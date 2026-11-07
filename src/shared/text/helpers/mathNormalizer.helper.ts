import { BEGIN_ENV_PATTERN, LATEX_CONTEXT, PLAIN_DISPLAY_ENVS, WRAPPED_DISPLAY_ENVS } from '../constants/mathNormalizer.constants';
import { isBlankLineBreak } from './codeSegments.helper';

const isWhitespace = (ch: string | undefined): boolean => ch !== undefined && /\s/.test(ch);
const isDigit = (ch: string | undefined): boolean => ch !== undefined && ch >= '0' && ch <= '9';

/**
 * First `closer` at or after `from`, skipping backslash escapes (`\x` pairs, so `\\)` is not
 * a `\)`). Returns -1 when there is none.
 */
export function findCloser(text: string, from: number, closer: string): number {
  let j = from;
  while (j < text.length) {
    if (text.startsWith(closer, j)) return j;
    j += text[j] === '\\' ? 2 : 1;
  }
  return -1;
}

/**
 * Closing `$` of inline math opened at `open` (Pandoc rule): the opening `$` is followed by
 * a non-space; the closing `$` follows a non-space and is not followed by a digit; no blank
 * line in between; backslash escapes are skipped. -1 when it is not math.
 */
export function findInlineMathClose(text: string, open: number): number {
  const first = text[open + 1];
  if (first === undefined || isWhitespace(first)) return -1;
  let j = open + 1;
  while (j < text.length) {
    const ch = text[j];
    if (ch === '\\') { j += 2; continue; }
    if (ch === '$' && !isWhitespace(text[j - 1]) && !isDigit(text[j + 1])) return j;
    if (isBlankLineBreak(text, j)) return -1;
    j++;
  }
  return -1;
}

/** Strict conversion of one prose segment (no code inside). See `normalizeMathDelimiters`. */
export function normalizeStrict(text: string): string {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const ch = text[i];

    if (ch === '\\') {
      const next = text[i + 1];
      // `\\` and `\$` are copied as a unit: `\\[2pt]` is a LaTeX line break, `\$` a literal dollar.
      if (next === '\\' || next === '$') { out += ch + next; i += 2; continue; }
      if (next === '(' || next === '[') {
        const converted = convertBracketMath(text, i, next === '(');
        if (converted) { out += converted.text; i = converted.end; continue; }
        out += ch + next;
        i += 2;
        continue;
      }
      const env = convertEnvironment(text, i);
      if (env) { out += env.text; i = env.end; continue; }
      out += ch;
      i++;
      continue;
    }

    if (ch === '$') {
      if (text[i + 1] === '$') {
        const close = findCloser(text, i + 2, '$$');
        const end = close === -1 ? i + 2 : close + 2;
        out += text.slice(i, end);
        i = end;
        continue;
      }
      const close = findInlineMathClose(text, i);
      const end = close === -1 ? i + 1 : close + 1;
      out += text.slice(i, end);
      i = end;
      continue;
    }

    out += ch;
    i++;
  }
  return out;
}

/** `\( x \)` → `$x$`, `\[ x \]` → `$$x$$`; null when unterminated or empty. */
function convertBracketMath(text: string, start: number, inline: boolean): { text: string; end: number } | null {
  const closer = inline ? '\\)' : '\\]';
  const close = findCloser(text, start + 2, closer);
  if (close === -1) return null;
  const inner = text.slice(start + 2, close).trim();
  if (!inner) return null;
  const delimiter = inline ? '$' : '$$';
  return { text: `${delimiter}${inner}${delimiter}`, end: close + closer.length };
}

/** `\begin{env}…\end{env}` → display math (see the env tables); null when not an env or unterminated. */
function convertEnvironment(text: string, start: number): { text: string; end: number } | null {
  BEGIN_ENV_PATTERN.lastIndex = start;
  const begin = BEGIN_ENV_PATTERN.exec(text);
  if (!begin) return null;
  const env = begin[1];
  const endTag = `\\end{${env}}`;
  const innerStart = start + begin[0].length;
  const close = findCloser(text, innerStart, endTag);
  if (close === -1) return null;
  const end = close + endTag.length;
  const inner = text.slice(innerStart, close).trim();

  if (PLAIN_DISPLAY_ENVS.has(env)) return { text: `$$${inner}$$`, end };
  const wrapped = WRAPPED_DISPLAY_ENVS[env];
  if (wrapped) return { text: `$$\\begin{${wrapped}}${inner}\\end{${wrapped}}$$`, end };
  return { text: `$$${text.slice(start, end)}$$`, end };
}

/** Legacy PDF heuristics, applied to one prose segment (no code inside). */
export function normalizeLoose(text: string): string {
  let result = '';
  let i = 0;

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
