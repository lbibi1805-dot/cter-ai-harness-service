import { Math as DocxMath, TextRun } from 'docx';
import { describe, expect, it } from 'vitest';
import { latexToMathComponents, textToRuns } from './latexMath';

const ROADMAP =
  '$\\text{Black-box overview} \\rightarrow \\text{EP} \\rightarrow \\text{BVA} \\rightarrow \\text{DTT} \\rightarrow \\text{State Transition} \\rightarrow \\text{Use Case}$';

describe('textToRuns', () => {
  it('renders long \\text/\\rightarrow chains as math, not literal text', () => {
    const runs = textToRuns(ROADMAP, false, false);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toBeInstanceOf(DocxMath);
  });

  it('still treats long plain-English in $...$ as text', () => {
    const long = '$This is a long plain English sentence without any LaTeX commands inside it$';
    const runs = textToRuns(long, false, false);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toBeInstanceOf(TextRun);
  });

  it('still excludes file citations from math', () => {
    const runs = textToRuns('$docs/Week-01/guide.md$', false, false);
    expect(runs[0]).toBeInstanceOf(TextRun);
  });

  it('keeps short variables as math', () => {
    const runs = textToRuns('biến $x$ tăng', false, false);
    expect(runs.some((r) => r instanceof DocxMath)).toBe(true);
  });
});

describe('latexToMathComponents', () => {
  it('parses \\text and \\rightarrow in long chains without throwing', () => {
    const components = latexToMathComponents(ROADMAP.slice(1, -1));
    expect(components.length).toBeGreaterThan(0);
  });
});
