import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, expect, it, vi } from 'vitest';
import type { DiagramCheck, DiagramRepairer, DiagramValidator } from '../../../../../src/modules/agent/domain';
import { DiagramSyntaxGuard } from '../../../../../src/modules/agent/application/diagramSyntaxGuard.service';
import { ValidateDiagramTool } from '../../../../../src/modules/agent/infrastructure/tools/validateDiagram.tool';
import { lintPlantUmlConnectivity } from '../../../../../src/modules/c4';
import { diagramGuardMetrics } from '../../../../../src/bootstrap/startup/diagramWiring';
import { EvalKind, listEvalResults } from '../../../../../src/modules/prompts';

const ORPHAN = '@startuml\n!include <C4/C4_Container>\nPerson(user, "User", "d")\nContainer(api, "API", "Node", "d")\nContainer(report, "Report", "Node", "d")\nRel(user, api, "Uses")\n@enduml';
const CONNECTED = ORPHAN.replace('@enduml', 'Rel(api, report, "Builds reports")\n@enduml');
const fenced = (body: string) => `Here:\n\n\`\`\`plantuml\n${body}\n\`\`\`\n\nDone.`;

/** Renders everything; adds the connectivity lint like the production validator (diagramWiring). */
const validator: DiagramValidator = {
  validate: async (source: string): Promise<DiagramCheck> => {
    const connectivity = lintPlantUmlConnectivity(source);
    return { ok: true, ...(connectivity.errors.length ? { connectivity } : {}) };
  },
};

function guard(repairer: DiagramRepairer | null) {
  return new DiagramSyntaxGuard({ enabled: true, maxRepairs: 1 }, validator, repairer, () => 0);
}

describe('chat diagram guard: connectivity lint (12/11 plan 04 §4.3)', () => {
  it('an orphan box uses the one repair round; the connected block replaces it; counters move', async () => {
    const repair = vi.fn<DiagramRepairer['repair']>(async () => CONNECTED);
    const g = guard({ repair });
    const out = await g.check(fenced(ORPHAN), 60_000, 't');
    expect(repair).toHaveBeenCalledTimes(1);
    expect(repair.mock.calls[0][0].error).toContain("ORPHAN_ELEMENT: 'report' has no relationship");
    expect(out.text).toContain('Rel(api, report, "Builds reports")');
    expect(out.text).not.toContain('⚠️');
    expect(g.stats()).toMatchObject({ orphanFound: 1, orphanRepaired: 1, connectivityErrors: 1, repairs: 1 });
  });

  it('an orphan the repair cannot fix keeps the block and adds one warning line under it', async () => {
    const g = guard({ repair: async () => ORPHAN });
    const out = await g.check(fenced(ORPHAN), 60_000, 't');
    expect(out.text).toContain("```\n\n> ⚠️ Sơ đồ còn khối chưa được nối đủ: 'report' has no relationship");
    expect(out.text.endsWith('Done.')).toBe(true);
    expect(g.stats()).toMatchObject({ orphanFound: 1, orphanRepaired: 0 });
  });

  it('without a repairer: warning only; a connected block is untouched', async () => {
    const g = guard(null);
    expect((await g.check(fenced(ORPHAN), 60_000, 't')).text).toContain('⚠️');
    expect((await g.check(fenced(CONNECTED), 60_000, 't')).text).toBe(fenced(CONNECTED));
  });

  it('validate_diagram reports connectivity errors next to OK', async () => {
    const result = await new ValidateDiagramTool(validator).execute({ source: ORPHAN });
    expect(result.content.split('\n')).toEqual(['OK', expect.stringContaining('CONNECTIVITY ERROR ORPHAN_ELEMENT')]);
  });

  it('/api/metrics/latency diagramGuard: chat + /c4 counters summed; null when neither runs', () => {
    const chat = guard(null).stats();
    expect(diagramGuardMetrics({ ...chat, orphanFound: 1 }, { orphanFound: 2, orphanRepaired: 1, connectivityErrors: 3 }))
      .toMatchObject({ orphanFound: 3, orphanRepaired: 1, connectivityErrors: 3 });
    expect(diagramGuardMetrics(null, { orphanFound: 1, orphanRepaired: 0, connectivityErrors: 1 })).toMatchObject({ answers: 0, orphanFound: 1 });
    expect(diagramGuardMetrics(null, null)).toBeNull();
  });
});

describe('GET /api/evals?kind=design-compliance (plan 04 §7.2)', () => {
  it('filters runs by kind', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'evals-'));
    fs.writeFileSync(path.join(dir, '2026-11-13-design-x.json'), JSON.stringify({ kind: EvalKind.DESIGN_COMPLIANCE, date: '2026-11-13', meanScore: 0.9 }));
    fs.writeFileSync(path.join(dir, '2026-11-13-rules-x.json'), JSON.stringify({ kind: EvalKind.RULE_COMPLIANCE, date: '2026-11-13', meanScore: 0.8 }));
    expect(listEvalResults(dir, 'design-compliance').map((r) => r.kind)).toEqual(['design-compliance']);
    expect(listEvalResults(dir)).toHaveLength(2);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
