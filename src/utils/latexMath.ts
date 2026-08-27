import {
  Math as DocxMath,
  MathFraction,
  MathRadical,
  MathRun,
  MathSubScript,
  MathSubSuperScript,
  MathSuperScript,
  TextRun,
} from 'docx';
import type { MathComponent, ParagraphChild } from 'docx';

export type InlineRun = ParagraphChild;

export const LATEX_SYMBOLS: Record<string, string> = {
  // ── Lowercase Greek (complete) ──────────────────────────────────────────────
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ',
  epsilon: 'ε', varepsilon: 'ε', zeta: 'ζ', eta: 'η',
  theta: 'θ', vartheta: 'ϑ', iota: 'ι', kappa: 'κ',
  lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ',
  pi: 'π', varpi: 'ϖ', rho: 'ρ', varrho: 'ϱ',
  sigma: 'σ', varsigma: 'ς', tau: 'τ', upsilon: 'υ',
  phi: 'φ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
  // ── Uppercase Greek (complete) ──────────────────────────────────────────────
  Alpha: 'Α', Beta: 'Β', Gamma: 'Γ', Delta: 'Δ', Epsilon: 'Ε',
  Zeta: 'Ζ', Eta: 'Η', Theta: 'Θ', Iota: 'Ι', Kappa: 'Κ',
  Lambda: 'Λ', Mu: 'Μ', Nu: 'Ν', Xi: 'Ξ', Pi: 'Π',
  Rho: 'Ρ', Sigma: 'Σ', Tau: 'Τ', Upsilon: 'Υ',
  Phi: 'Φ', Chi: 'Χ', Psi: 'Ψ', Omega: 'Ω',
  // ── Relations ───────────────────────────────────────────────────────────────
  neq: '≠', ne: '≠', leq: '≤', le: '≤', geq: '≥', ge: '≥',
  ll: '≪', gg: '≫', approx: '≈', sim: '∼', simeq: '≃',
  cong: '≅', equiv: '≡', propto: '∝',
  in: '∈', notin: '∉', ni: '∋',
  subset: '⊂', supset: '⊃', subseteq: '⊆', supseteq: '⊇',
  perp: '⊥', parallel: '∥', angle: '∠',
  // ── Operators ───────────────────────────────────────────────────────────────
  times: '×', div: '÷', cdot: '·', pm: '±', mp: '∓',
  oplus: '⊕', otimes: '⊗', circ: '∘', bullet: '•',
  cap: '∩', cup: '∪', setminus: '∖',
  sum: 'Σ', prod: 'Π', int: '∫', oint: '∮',
  partial: '∂', nabla: '∇', infty: '∞',
  forall: '∀', exists: '∃', nexists: '∄', emptyset: '∅',
  // ── Arrows ──────────────────────────────────────────────────────────────────
  to: '→', gets: '←', leftarrow: '←', rightarrow: '→',
  Leftarrow: '⇐', Rightarrow: '⇒',
  leftrightarrow: '↔', Leftrightarrow: '⇔',
  uparrow: '↑', downarrow: '↓', updownarrow: '↕',
  nearrow: '↗', searrow: '↘', mapsto: '↦',
  // ── Dots ────────────────────────────────────────────────────────────────────
  ldots: '…', cdots: '⋯', dots: '…', vdots: '⋮', ddots: '⋱',
  // ── Brackets (used with \left \right) ───────────────────────────────────────
  langle: '⟨', rangle: '⟩',
  lfloor: '⌊', rfloor: '⌋',
  lceil: '⌈', rceil: '⌉',
  // ── Chemistry / Physics ──────────────────────────────────────────────────────
  rightleftharpoons: '⇌', leftrightharpoons: '⇌',
  rightharpoonup: '⇀', rightharpoondown: '⇁',
  leftharpoonup: '↼', leftharpoondown: '↽',
  // ── Misc ────────────────────────────────────────────────────────────────────
  hbar: 'ℏ', ell: 'ℓ', aleph: 'ℵ',
  therefore: '∴', because: '∵',
  dagger: '†', ddagger: '‡',
};

type MathSegment =
  | { kind: 'text'; value: string }
  | { kind: 'math'; value: string };

// Math if: has \cmd / ^ / _ scripts, OR short enough to be a symbol/variable.
// Prevents pairing $...$ across long plain-English sentences.
// Excludes file-path citations (containing .md/.docx/§).
function looksLikeMathContent(content: string): boolean {
  if (content.length > 80) return false;
  if (/\.(?:md|docx?|pdf)\b|§/.test(content)) return false;
  return /\\[a-zA-Z]|[_^]/.test(content) || content.length <= 10;
}

function splitMathSegments(text: string): MathSegment[] {
  const segments: MathSegment[] = [];
  let buffer = '';
  let i = 0;

  while (i < text.length) {
    const delimiter = text.startsWith('$$', i) ? '$$' : text[i] === '$' ? '$' : null;
    if (!delimiter || (i > 0 && text[i - 1] === '\\')) {
      buffer += text[i];
      i += 1;
      continue;
    }

    const end = text.indexOf(delimiter, i + delimiter.length);
    if (end === -1) {
      buffer += text[i];
      i += 1;
      continue;
    }

    const mathContent = text.slice(i + delimiter.length, end).trim();
    // Only treat as math if content looks like a formula (has LaTeX cmds, scripts,
    // or is short enough to be a variable/constant). Long plain-English text is not math.
    if (!looksLikeMathContent(mathContent)) {
      // Non-math content wrapped in $$ or $: keep content as plain text, strip delimiters
      buffer += mathContent;
      i = end + delimiter.length;
      continue;
    }

    if (buffer) {
      segments.push({ kind: 'text', value: buffer });
      buffer = '';
    }
    segments.push({ kind: 'math', value: mathContent });
    i = end + delimiter.length;
  }

  if (buffer) segments.push({ kind: 'text', value: buffer });
  return segments;
}

export function textToRuns(text: string, bold: boolean, italics: boolean): InlineRun[] {
  return splitMathSegments(text).flatMap((segment): InlineRun[] => {
    if (segment.kind === 'math') {
      return [new DocxMath({ children: latexToMathComponents(segment.value) })];
    }
    return [new TextRun({ text: segment.value.replace(/\\\$/g, '$'), bold, italics })];
  });
}

export function latexToMathComponents(input: string): MathComponent[] {
  class Parser {
    private index = 0;

    constructor(private readonly source: string) {}

    // Math function names rendered as upright text (not italic)
    private static readonly FUNCTIONS = new Set([
      'sin', 'cos', 'tan', 'cot', 'sec', 'csc',
      'arcsin', 'arccos', 'arctan',
      'sinh', 'cosh', 'tanh',
      'log', 'ln', 'lg', 'exp',
      'lim', 'limsup', 'liminf', 'sup', 'inf',
      'max', 'min', 'arg', 'det', 'dim', 'ker',
      'gcd', 'lcm', 'Pr', 'deg', 'mod',
    ]);

    parseUntil(endChar?: string): MathComponent[] {
      const components: MathComponent[] = [];

      while (this.index < this.source.length) {
        if (endChar && this.source[this.index] === endChar) {
          this.index += 1;
          break;
        }

        const ch = this.source[this.index];

        // Inline group {…} — expand in-place so sub/superscripts work inside
        if (ch === '{') {
          this.index += 1;
          components.push(...this.parseUntil('}'));
          continue;
        }

        if (ch === '_' || ch === '^') {
          this.applyScript(components, ch);
          continue;
        }

        components.push(this.parseAtom());
      }

      return components.length ? components : [new MathRun('')];
    }

    private parseAtom(): MathComponent {
      const ch = this.source[this.index];
      if (ch === '\\') return this.parseCommand();
      this.index += 1;
      return new MathRun(ch);
    }

    private parseCommand(): MathComponent {
      this.index += 1;
      const command = this.readCommandName();

      // \left / \right — render the bracket char that follows
      if (command === 'left' || command === 'right') {
        this.skipSpaces();
        const next = this.source[this.index];
        if (next) {
          this.index += 1;
          const bracket = next === '\\' ? this.readDelimiter() : next;
          return new MathRun(bracket === '.' ? '' : bracket);
        }
        return new MathRun('');
      }

      // \frac{num}{den}
      if (command === 'frac') {
        return new MathFraction({
          numerator: this.parseRequiredGroup(),
          denominator: this.parseRequiredGroup(),
        });
      }

      // \sqrt{…}
      if (command === 'sqrt') {
        return new MathRadical({ children: this.parseRequiredGroup() });
      }

      // Accent commands — apply combining Unicode character
      const ACCENT: Record<string, string> = {
        bar: '̅', overline: '̅',
        hat: '̂', widehat: '̂',
        tilde: '̃', widetilde: '̃',
        vec: '⃗',
        dot: '̇', ddot: '̈',
        acute: '́', grave: '̀',
        breve: '̆', check: '̌',
      };
      if (ACCENT[command] !== undefined) {
        const inner = latexToPlainText(this.parseRequiredGroupRaw());
        return new MathRun(inner.split('').map(c => c + ACCENT[command]).join(''));
      }

      // \text{…} \mathrm{…} \mathbf{…} \mathit{…} \mathbb{…} — plain text
      if (/^(text|mathrm|mathbf|mathit|mathbb|mbox|hbox)$/.test(command)) {
        return new MathRun(latexToPlainText(this.parseRequiredGroupRaw()));
      }

      // Function names (\sin, \lim, …) — render upright
      if (Parser.FUNCTIONS.has(command)) {
        return new MathRun(command);
      }

      // Symbol lookup, fallback to command name
      return new MathRun(LATEX_SYMBOLS[command] ?? command);
    }

    // Read a delimiter after \left / \right (handles \langle etc.)
    private readDelimiter(): string {
      const name = this.readCommandName();
      return LATEX_SYMBOLS[name] ?? name;
    }

    private applyScript(components: MathComponent[], marker: '_' | '^'): void {
      this.index += 1;
      if (components.length === 0) {
        components.push(new MathRun(marker));
        return;
      }

      const base = components.pop()!;
      const firstScript = this.parseScriptValue();
      const nextMarker = this.source[this.index];

      if ((marker === '_' && nextMarker === '^') || (marker === '^' && nextMarker === '_')) {
        this.index += 1;
        const secondScript = this.parseScriptValue();
        components.push(new MathSubSuperScript({
          children: [base],
          subScript: marker === '_' ? firstScript : secondScript,
          superScript: marker === '^' ? firstScript : secondScript,
        }));
        return;
      }

      components.push(marker === '_'
        ? new MathSubScript({ children: [base], subScript: firstScript })
        : new MathSuperScript({ children: [base], superScript: firstScript }));
    }

    private parseScriptValue(): MathComponent[] {
      this.skipSpaces();
      if (this.source[this.index] === '{') {
        this.index += 1;
        return this.parseUntil('}');
      }
      return [this.parseAtom()];
    }

    private parseRequiredGroup(): MathComponent[] {
      const group = this.parseRequiredGroupRaw();
      return group === undefined ? [this.parseAtom()] : new Parser(group).parseUntil();
    }

    private parseRequiredGroupRaw(): string | undefined {
      this.skipSpaces();
      if (this.source[this.index] !== '{') return undefined;

      let depth = 0;
      const start = this.index + 1;
      for (; this.index < this.source.length; this.index += 1) {
        const ch = this.source[this.index];
        if (ch === '{') depth += 1;
        if (ch === '}') {
          depth -= 1;
          if (depth === 0) {
            const value = this.source.slice(start, this.index);
            this.index += 1;
            return value;
          }
        }
      }

      return this.source.slice(start);
    }

    private readCommandName(): string {
      const start = this.index;
      while (/[A-Za-z]/.test(this.source[this.index] ?? '')) this.index += 1;
      if (start === this.index && this.index < this.source.length) {
        this.index += 1;
      }
      return this.source.slice(start, this.index);
    }

    private skipSpaces(): void {
      while (this.source[this.index] === ' ') this.index += 1;
    }
  }

  return new Parser(input).parseUntil();
}

export function latexToPlainText(input: string | undefined): string {
  if (!input) return '';
  return input
    .replace(/\\([A-Za-z]+)/g, (_, command) => LATEX_SYMBOLS[command] ?? command)
    .replace(/[{}]/g, '');
}

export function addCombiningOverline(value: string): string {
  return value.split('').map((ch) => ch === ' ' ? ch : `${ch}\u0305`).join('');
}
