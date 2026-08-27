import type { Token, Tokens } from 'marked';
import { normalizeMathDelimiters } from './mathNormalizer';
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { textToRuns, type InlineRun } from './latexMath';

type DocxEl = Paragraph | Table;

// ── Inline tokens → TextRun[] ───────────────────────────────────────────────

function toRuns(tokens: Token[], bold = false, italics = false): InlineRun[] {
  const result: InlineRun[] = [];
  for (const t of tokens) {
    switch (t.type) {
      case 'text': {
        const tt = t as Tokens.Text;
        if (tt.tokens?.length) result.push(...toRuns(tt.tokens, bold, italics));
        else result.push(...textToRuns(tt.text, bold, italics));
        break;
      }
      case 'strong':
        result.push(...toRuns((t as Tokens.Strong).tokens, true, italics));
        break;
      case 'em':
        result.push(...toRuns((t as Tokens.Em).tokens, bold, true));
        break;
      case 'codespan':
        result.push(new TextRun({
          text: (t as Tokens.Codespan).text,
          font: 'Courier New',
          shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F0F0F0' },
        }));
        break;
      case 'br':
        result.push(new TextRun({ break: 1 }));
        break;
      default:
        if ('text' in t) result.push(...textToRuns((t as any).text, bold, italics));
    }
  }
  return result.length ? result : [new TextRun({ text: '' })];
}

// ── List item content → TextRun[] ───────────────────────────────────────────

function itemRuns(item: Tokens.ListItem): InlineRun[] {
  const runs: InlineRun[] = [];
  for (const t of item.tokens) {
    if (t.type === 'text') {
      const tt = t as Tokens.Text;
      runs.push(...toRuns(tt.tokens?.length ? tt.tokens : [t as Token]));
    } else if (t.type === 'paragraph') {
      runs.push(...toRuns((t as Tokens.Paragraph).tokens));
    }
  }
  return runs.length ? runs : [new TextRun({ text: '' })];
}

// ── Block tokens → DocxEl[] ─────────────────────────────────────────────────

const HEADING_LEVELS = [
  HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6,
];

function toElements(token: Token): DocxEl[] {
  switch (token.type) {
    case 'heading': {
      const h = token as Tokens.Heading;
      return [new Paragraph({
        heading: HEADING_LEVELS[h.depth - 1] ?? HeadingLevel.HEADING_6,
        children: toRuns(h.tokens),
      })];
    }

    case 'paragraph':
      return [new Paragraph({ children: toRuns((token as Tokens.Paragraph).tokens) })];

    case 'list': {
      const l = token as Tokens.List;
      return l.items.flatMap((item) => {
        const runs = itemRuns(item);
        const para = l.ordered
          ? new Paragraph({ children: runs, numbering: { reference: 'ordered', level: 0 } })
          : new Paragraph({ children: runs, bullet: { level: 0 } });

        // Nested lists (level 1)
        const nested = item.tokens.filter(t => t.type === 'list') as Tokens.List[];
        const nestedParas = nested.flatMap(nl =>
          nl.items.map(ni => nl.ordered
            ? new Paragraph({ children: itemRuns(ni), numbering: { reference: 'ordered', level: 1 } })
            : new Paragraph({ children: itemRuns(ni), bullet: { level: 1 } })
          )
        );
        return [para, ...nestedParas];
      });
    }

    case 'table': {
      const t = token as Tokens.Table;
      return [new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            tableHeader: true,
            children: t.header.map(cell => new TableCell({
              shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'D9D9D9' },
              children: [new Paragraph({
                children: toRuns(cell.tokens),
                alignment: AlignmentType.CENTER,
              })],
            })),
          }),
          ...t.rows.map(row => new TableRow({
            children: row.map(cell => new TableCell({
              children: [new Paragraph({ children: toRuns(cell.tokens) })],
            })),
          })),
        ],
      })];
    }

    case 'code':
      return (token as Tokens.Code).text.split('\n').map(line =>
        new Paragraph({
          children: [new TextRun({ text: line || ' ', font: 'Courier New' })],
          indent: { left: 360 },
        })
      );

    case 'blockquote':
      return (token as Tokens.Blockquote).tokens.flatMap(t => {
        if (t.type === 'paragraph') {
          return [new Paragraph({
            children: [new TextRun({ text: '│ ', color: '888888' }), ...toRuns((t as Tokens.Paragraph).tokens)],
            indent: { left: 720 },
          })];
        }
        return toElements(t);
      });

    case 'hr':
      return [new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'AAAAAA', space: 1 } },
        children: [],
      })];

    case 'space':
      return [new Paragraph({ children: [] })];

    default:
      return 'text' in token
        ? [new Paragraph({ children: [new TextRun({ text: (token as any).text })] })]
        : [];
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function markdownToDocx(
  title: string,
  meta: Record<string, string>,
  body: string,
): Promise<Buffer> {
  const metaRows = Object.entries(meta).map(([k, v]) =>
    new Paragraph({
      children: [new TextRun({ text: `${k}: `, bold: true }), new TextRun({ text: v })],
      spacing: { after: 60 },
    })
  );

  const separator = new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CCCCCC', space: 1 } },
    spacing: { after: 200 },
    children: [],
  });

  const { marked } = await import('marked');
  const bodyElements = (marked.lexer(normalizeMathDelimiters(body)) as Token[]).flatMap(toElements);

  const doc = new Document({
    numbering: {
      config: [{
        reference: 'ordered',
        levels: [{
          level: 0,
          format: LevelFormat.DECIMAL,
          text: '%1.',
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }, {
          level: 1,
          format: LevelFormat.LOWER_LETTER,
          text: '%2.',
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 1080, hanging: 360 } } },
        }],
      }],
    },
    sections: [{
      children: [
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun({ text: title, bold: true })],
          spacing: { after: 200 },
        }),
        ...metaRows,
        separator,
        ...bodyElements,
      ],
    }],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
