import {
  C4Direction,
  C4ElementKind,
  C4ElementVariant,
  C4Level,
  type C4DiagramSpec,
  type C4Element,
  type C4Requirement,
} from '../../src/modules/c4/domain';

export function element(id: string, kind: C4ElementKind, extra: Partial<C4Element> = {}): C4Element {
  return { id, kind, variant: C4ElementVariant.STANDARD, external: false, name: id.toUpperCase(), desc: `${id} desc`, covers: [], ...extra };
}

export const REQUIREMENTS: C4Requirement[] = [
  { id: 'R1', text: 'Customers book tickets', levels: [C4Level.CONTEXT, C4Level.CONTAINER] },
  { id: 'R2', text: 'Bookings are stored', levels: [C4Level.CONTAINER] },
  { id: 'R3', text: 'Pay via VNPay', levels: [C4Level.CONTEXT, C4Level.CONTAINER] },
];

/** Container spec that misses R3 (no payment relationship). */
export function containerSpec(): C4DiagramSpec {
  return {
    title: 'Cinema - Containers',
    elements: [
      element('customer', C4ElementKind.PERSON, { name: 'Customer', desc: 'Books "tickets"', covers: ['R1'] }),
      element('cinema', C4ElementKind.SYSTEM_BOUNDARY, { name: 'Cinema' }),
      element('api', C4ElementKind.CONTAINER, { name: 'API', tech: 'ASP.NET Core', desc: 'Business logic', parent: 'cinema' }),
      element('db', C4ElementKind.CONTAINER, { variant: C4ElementVariant.DB, name: 'Database', tech: 'PostgreSQL', desc: 'Stores bookings', parent: 'cinema', covers: ['R2'] }),
      element('pay', C4ElementKind.SYSTEM, { external: true, name: 'VNPay', desc: 'Payment gateway' }),
    ],
    rels: [
      { from: 'customer', to: 'api', label: 'Books', tech: 'HTTPS', dir: C4Direction.DOWN, covers: ['R1'] },
      { from: 'api', to: 'db', label: 'Reads/writes', covers: [] },
    ],
  };
}

export function fixedContainerSpec(): C4DiagramSpec {
  const spec = containerSpec();
  spec.rels.push({ from: 'api', to: 'pay', label: 'Charges', tech: 'HTTPS', dir: C4Direction.RIGHT, covers: ['R3'] });
  return spec;
}

export const CONTEXT_SPEC_JSON = {
  title: 'Cinema - Context',
  elements: [
    { id: 'customer', kind: 'person', name: 'Customer', desc: 'Books tickets', covers: ['R1'] },
    { id: 'cinema', kind: 'system', name: 'Cinema', desc: 'Sells tickets', covers: ['R1'] },
    { id: 'pay', kind: 'system', external: true, name: 'VNPay', desc: 'Payment gateway', covers: ['R3'] },
  ],
  rels: [
    { from: 'customer', to: 'cinema', label: 'Books tickets', dir: 'D', covers: ['R1'] },
    { from: 'cinema', to: 'pay', label: 'Charges', dir: 'R', covers: ['R3'] },
  ],
};
