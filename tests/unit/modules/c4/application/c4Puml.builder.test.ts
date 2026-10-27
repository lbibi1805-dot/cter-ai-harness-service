import { describe, expect, it } from 'vitest';
import { C4PumlBuilder } from '../../../../../src/modules/c4';
import { C4ElementKind, C4Level, type C4DiagramSpec } from '../../../../../src/modules/c4/domain';
import { element, fixedContainerSpec } from '../../../../support/c4Fixture';

describe('C4PumlBuilder', () => {
  it('emits the repo includes, macros, nested boundaries and directed relationships', () => {
    const puml = new C4PumlBuilder({ showLegend: true }).build(fixedContainerSpec(), C4Level.CONTAINER);
    expect(puml.startsWith('@startuml\n!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Container.puml\nHIDE_STEREOTYPE()')).toBe(true);
    expect(puml).toContain('Person(customer, "Customer", "Books \'tickets\'")');
    expect(puml).toContain('System_Boundary(cinema, "Cinema") {');
    expect(puml).toContain('  Container(api, "API", "ASP.NET Core", "Business logic")');
    expect(puml).toContain('  ContainerDb(db, "Database", "PostgreSQL", "Stores bookings")');
    expect(puml).toContain('System_Ext(pay, "VNPay", "Payment gateway")');
    expect(puml).toContain('Rel_D(customer, api, "Books", "HTTPS")');
    expect(puml).toContain('Rel(api, db, "Reads/writes")');
    expect(puml).toContain('Rel_R(api, pay, "Charges", "HTTPS")');
    expect(puml).toContain('SHOW_LEGEND()');
    expect(puml).not.toContain('ExistingProject');
    expect(puml.endsWith('@enduml')).toBe(true);
  });

  it('uses the PlantUML stdlib when configured and omits the legend by default', () => {
    const puml = new C4PumlBuilder({ includeBase: 'stdlib' }).build(fixedContainerSpec(), C4Level.COMPONENT);
    expect(puml).toContain('!include <C4/C4_Component>');
    expect(puml).not.toContain('SHOW_LEGEND');
  });

  it('writes sequence messages in order with phase dividers and no _Ext', () => {
    const spec: C4DiagramSpec = {
      title: 'Checkout',
      elements: [
        element('user', C4ElementKind.PERSON),
        element('api', C4ElementKind.CONTAINER, { tech: 'Node' }),
        element('pay', C4ElementKind.SYSTEM, { external: true }),
      ],
      rels: [
        { from: 'user', to: 'api', label: 'Pay', phase: 'Payment', covers: [] },
        { from: 'api', to: 'pay', label: 'Charge', phase: 'Payment', covers: [] },
        { from: 'api', to: 'user', label: 'Done', phase: 'Confirm', covers: [] },
      ],
    };
    const puml = new C4PumlBuilder().build(spec, C4Level.SEQUENCE);
    expect(puml).toContain('C4_Sequence.puml');
    expect(puml).toContain('System(pay, "PAY", "pay desc")');
    expect(puml).not.toContain('_Ext');
    const order = ['== Payment ==', 'Rel(user, api', 'Rel(api, pay', '== Confirm ==', 'Rel(api, user'].map((s) => puml.indexOf(s));
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('keeps every argument on one line without raw double quotes', () => {
    const spec = fixedContainerSpec();
    spec.title = 'Line\nbreak';
    spec.elements[0].desc = 'say "hi"\n  now';
    const puml = new C4PumlBuilder().build(spec, C4Level.CONTAINER);
    expect(puml).toContain('title Line break');
    expect(puml).toContain('"say \'hi\' now"');
  });
});
