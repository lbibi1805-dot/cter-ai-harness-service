import { describe, expect, it } from 'vitest';
import {
  analyzeGaps,
  applyAnswers,
  BriefSource,
  briefStatement,
  C4Slot,
  CloudScope,
  emptyBrief,
  mergeBrief,
  toBriefOverride,
  toProblemBrief,
  type ProblemBrief,
} from '../../../../../src/modules/c4/domain';

/** Every high/medium slot is confident: only the plan-04 low slots can be asked. */
function confident(extra: Record<string, unknown> = {}): ProblemBrief {
  return toProblemBrief({
    systemName: { value: 'LMS', confidence: 0.9 }, systemBoundary: { value: 'LMS', confidence: 0.9 },
    actors: { value: ['Student'], confidence: 0.9 }, externalSystems: { value: [], confidence: 0.9 },
    techConstraints: { value: [], confidence: 0.9 }, levels: { value: ['container'], confidence: 0.9 }, ...extra,
  }, BriefSource.TEXT);
}

const OPTIONS = { fast: false, reviewWithDesign: false, revise: false };

describe('brief slots tenancy / deployment_target (12/11 plan 04 §5.2)', () => {
  it('parses tenancy signals, cloud scope and scale hints', () => {
    const brief = confident({
      tenancySignals: { value: ['SaaS cho nhiều trường'], confidence: 0.9 },
      cloudScope: { value: 'hybrid', confidence: 0.8 },
      scaleHints: ['50k users at peak'],
    });
    expect(brief.tenancySignals).toMatchObject({ value: ['SaaS cho nhiều trường'], confidence: 0.9 });
    expect(brief.cloudScope).toMatchObject({ value: CloudScope.HYBRID, confidence: 0.8 });
    expect(briefStatement(brief, '')).toContain('Tenancy signals: SaaS cho nhiều trường');
    expect(briefStatement(brief, '')).toContain('Deployment target: hybrid');
    expect(briefStatement(brief, '')).toContain('Scale: 50k users at peak');
  });

  it('a statement that says nothing is not asked (default used); clear signals are not asked either', () => {
    expect(analyzeGaps(confident(), OPTIONS).questions).toEqual([]);
    expect(analyzeGaps(confident({ tenancySignals: { value: ['nhiều trường'], confidence: 0.9 }, cloudScope: { value: 'full-cloud', confidence: 0.9 } }), OPTIONS).questions).toEqual([]);
  });

  it('unclear signals are asked last, within the 3 questions, with a default', () => {
    const gaps = analyzeGaps(confident({ tenancySignals: { value: ['có thể bán cho công ty khác'], confidence: 0.4 }, cloudScope: { value: 'aws', confidence: 0.3 } }), OPTIONS);
    expect(gaps.questions.map((q) => q.slot)).toEqual([C4Slot.TENANCY, C4Slot.DEPLOYMENT_TARGET]);
    expect(gaps.questions[0].default).toContain('pool');
    expect(gaps.questions[1].default).toBe(CloudScope.FULL_CLOUD);
    const unsure = toProblemBrief({ tenancySignals: { value: ['?'], confidence: 0.3 } }, BriefSource.TEXT);
    expect(analyzeGaps(unsure, OPTIONS).questions).toHaveLength(3);
  });

  it('answers set the slots', () => {
    const brief = confident({ tenancySignals: { value: ['x'], confidence: 0.4 }, cloudScope: { value: 'aws', confidence: 0.3 } });
    const questions = analyzeGaps(brief, OPTIONS).questions;
    const answered = applyAnswers(brief, questions, { [C4Slot.TENANCY]: 'Một tổ chức', [C4Slot.DEPLOYMENT_TARGET]: 'on-prem' });
    expect(answered.tenancySignals?.value[0]).toContain('không cần multi-tenancy');
    expect(answered.cloudScope).toMatchObject({ value: CloudScope.ON_PREM, confidence: 1 });
  });

  it('typed text overrides; an old brief without the new fields still merges', () => {
    const old = emptyBrief();
    delete old.tenancySignals;
    delete old.cloudScope;
    delete old.scaleHints;
    const merged = mergeBrief(old, toBriefOverride({ cloudScope: { value: 'on-prem', confidence: 1 }, scaleHints: ['1k users'] }));
    expect(merged.cloudScope?.value).toBe(CloudScope.ON_PREM);
    expect(merged.scaleHints).toEqual(['1k users']);
    expect(merged.tenancySignals?.value).toEqual([]);
  });
});
