import { describe, expect, it } from 'vitest';
import { C4ElementKind, C4Level, toDiagramSpec, validateDiagram } from '../../../../../src/modules/c4/domain';
import { containerSpec, element, fixedContainerSpec, REQUIREMENTS } from '../../../../support/c4Fixture';

const LIMITS = { maxElements: 12 };

describe('validateDiagram', () => {
  it('accepts a spec that covers every requirement of its level', () => {
    const v = validateDiagram(fixedContainerSpec(), C4Level.CONTAINER, REQUIREMENTS, LIMITS);
    expect(v.errors).toEqual([]);
    expect(v.covered).toEqual(['R1', 'R2', 'R3']);
    expect(v.score).toBe(0);
  });

  it('reports uncovered requirements, dangling ids and missing technology', () => {
    const spec = containerSpec();
    spec.elements.find((e) => e.id === 'api')!.tech = undefined;
    spec.rels.push({ from: 'api', to: 'ghost', label: 'Calls', covers: [] });
    const v = validateDiagram(spec, C4Level.CONTAINER, REQUIREMENTS, LIMITS);
    expect(v.errors).toEqual(expect.arrayContaining([
      "container 'api' needs a technology (tech).",
      "Relationship 'Calls' ends at unknown id 'ghost'.",
      'Requirement R3 is not covered: Pay via VNPay',
    ]));
    expect(v.missing).toEqual(['R3']);
  });

  it('prunes elements that cover nothing and connect to nothing, then empty boundaries', () => {
    const spec = fixedContainerSpec();
    spec.elements.push(element('cache', C4ElementKind.CONTAINER, { tech: 'Redis', parent: 'cinema' }));
    spec.elements.push(element('empty', C4ElementKind.SYSTEM_BOUNDARY));
    const v = validateDiagram(spec, C4Level.CONTAINER, [], LIMITS);
    expect(v.spec.elements.map((e) => e.id)).not.toContain('cache');
    expect(v.spec.elements.map((e) => e.id)).not.toContain('empty');
    expect(v.errors).toEqual([]);
  });

  it('enforces level rules and the element limit', () => {
    expect(validateDiagram(fixedContainerSpec(), C4Level.CONTEXT, [], LIMITS).errors)
      .toContain("Element 'api' of kind 'container' does not belong in a context diagram.");
    expect(validateDiagram(fixedContainerSpec(), C4Level.CONTAINER, [], { maxElements: 3 }).errors[0])
      .toMatch(/Too many elements \(4 > 3\)/);
  });

  it('flattens sequence diagrams: no boundaries, parents or _Ext', () => {
    const v = validateDiagram(fixedContainerSpec(), C4Level.SEQUENCE, [], LIMITS);
    expect(v.spec.elements.some((e) => e.kind === C4ElementKind.SYSTEM_BOUNDARY || e.parent || e.external)).toBe(false);
  });

  it('requires the shared model actors and external systems in context/container diagrams', () => {
    const spec = fixedContainerSpec();
    const rules = { maxElements: 12, requiredElements: [{ id: 'customer', name: 'Customer' }, { id: 'sso', name: 'SSO' }] };
    expect(validateDiagram(spec, C4Level.CONTAINER, [], rules).errors).toEqual([
      "'SSO' (id sso) from the shared model is missing: container diagrams show every actor and external system, connected by a relationship.",
    ]);
    expect(validateDiagram(spec, C4Level.COMPONENT, [], rules).errors).toEqual([]);
  });

  it('requires shared-model elements to be connected and elements to have a description', () => {
    const spec = fixedContainerSpec();
    spec.elements.push(element('librarian', C4ElementKind.PERSON, { name: 'Librarian', covers: ['R1'] }));
    spec.elements.find((e) => e.id === 'api')!.desc = '';
    const errors = validateDiagram(spec, C4Level.CONTAINER, [], { maxElements: 12, requiredElements: [{ id: 'librarian', name: 'Librarian' }] }).errors;
    expect(errors).toEqual([
      "Element 'api' needs a short description (desc).",
      "'Librarian' (id librarian) has no relationship: connect it to the element it uses or that uses it.",
    ]);
  });

  it('draws people as Person, never Person_Ext', () => {
    const spec = fixedContainerSpec();
    spec.elements[0].external = true;
    expect(validateDiagram(spec, C4Level.CONTAINER, [], LIMITS).spec.elements[0].external).toBe(false);
  });

  it('does not mutate its input', () => {
    const spec = containerSpec();
    const before = JSON.stringify(spec);
    validateDiagram(spec, C4Level.SEQUENCE, REQUIREMENTS, LIMITS);
    expect(JSON.stringify(spec)).toBe(before);
  });
});

describe('toDiagramSpec', () => {
  it('coerces loose model JSON: aliases, ids, implied variants, single covers', () => {
    const spec = toDiagramSpec({
      title: 'T',
      elements: [
        { id: 'web-app', kind: 'Container', technology: 'React', name: 'Web' },
        { id: '3store', kind: 'database', tech: 'PG', name: 'DB', parent: 'null', covers: 'R1' },
      ],
      relationships: [{ source: 'web-app', target: '3store', description: 'reads', dir: 'down' }],
    });
    expect(spec.elements[0]).toMatchObject({ id: 'web_app', kind: 'container', tech: 'React' });
    expect(spec.elements[1]).toMatchObject({ id: 'e_3store', kind: 'container', variant: 'db', parent: undefined, covers: ['R1'] });
    expect(spec.rels[0]).toMatchObject({ from: 'web_app', to: 'e_3store', label: 'reads', dir: 'D' });
  });
});
