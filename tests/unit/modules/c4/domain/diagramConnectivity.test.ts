import { describe, expect, it } from 'vitest';
import {
  C4ElementKind,
  C4ElementVariant,
  C4Level,
  C4Scaling,
  checkConnectivity,
  ConnectivityCode,
  discussionTopicsPresent,
  DISCUSSION_PLACEHOLDER,
  DISCUSSION_SECTIONS,
  ensureDiscussionFrame,
  lintPlantUmlConnectivity,
  toDiagramSpec,
  toInstances,
  validateDiagram,
  type C4DiagramSpec,
  type C4Element,
  type ConnectivityReport,
} from '../../../../../src/modules/c4/domain';
import { C4PumlBuilder } from '../../../../../src/modules/c4';
import { element } from '../../../../support/c4Fixture';

const container = (id: string, extra: Partial<C4Element> = {}) => element(id, C4ElementKind.CONTAINER, { tech: 'Spring Boot', parent: 'sys', instances: '2', ...extra });
const db = (id: string, extra: Partial<C4Element> = {}) => container(id, { variant: C4ElementVariant.DB, tech: 'PostgreSQL', ...extra });
const rel = (from: string, to: string, label = 'Calls') => ({ from, to, label, covers: [] as string[] });

function spec(elements: C4Element[], rels: Array<ReturnType<typeof rel>>, title = 'Shop'): C4DiagramSpec {
  return { title, elements: [element('sys', C4ElementKind.SYSTEM_BOUNDARY, { name: 'Shop' }), ...elements], rels };
}

const codes = (report: ConnectivityReport) => ({ errors: report.errors.map((i) => i.code), warnings: report.warnings.map((i) => i.code) });

/** A connected microservice design with a gateway, one DB per service, a queue with both sides and instances. */
function goodMicroservices(): C4DiagramSpec {
  return spec([
    element('user', C4ElementKind.PERSON, { name: 'Customer' }),
    container('web', { name: 'Web App', tech: 'React', instances: undefined }),
    container('gateway', { name: 'API Gateway', tech: 'Kong' }),
    container('order_service', { name: 'Order Service' }),
    container('payment_service', { name: 'Payment Service' }),
    db('order_db', { name: 'Order DB' }),
    db('payment_db', { name: 'Payment DB' }),
    container('events', { name: 'Kafka', tech: 'Kafka', variant: C4ElementVariant.QUEUE }),
    container('discovery', { name: 'Discovery Service', tech: 'Eureka' }),
  ], [
    rel('user', 'web', 'Uses'), rel('web', 'gateway', 'Calls API'), rel('gateway', 'order_service', 'Routes'), rel('gateway', 'payment_service', 'Routes'),
    rel('order_service', 'order_db', 'Reads/writes'), rel('payment_service', 'payment_db', 'Reads/writes'),
    rel('order_service', 'events', 'Publishes OrderPlaced'), rel('payment_service', 'events', 'Consumes OrderPlaced'),
    rel('order_service', 'discovery', 'Registers / sends heartbeat'), rel('payment_service', 'discovery', 'Registers / sends heartbeat'),
    rel('gateway', 'discovery', 'Resolves service instances'),
  ], 'Shop microservices');
}

describe('connectivity rules C1–C9 (12/11 plan 04 §4.2)', () => {
  it('a connected microservice design passes every rule', () => {
    expect(codes(checkConnectivity(goodMicroservices(), C4Level.CONTAINER))).toEqual({ errors: [], warnings: [] });
  });

  it('C1 ORPHAN_ELEMENT: an element with no relationship is an error with its id', () => {
    const s = goodMicroservices();
    s.elements.push(container('report_service', { name: 'Report Service' }));
    const report = checkConnectivity(s, C4Level.CONTAINER);
    expect(report.errors.find((i) => i.code === ConnectivityCode.ORPHAN_ELEMENT)?.elementIds).toEqual(['report_service']);
  });

  it('C2 DISCONNECTED_GRAPH: two separate groups are an error listing the smaller group', () => {
    const s = goodMicroservices();
    s.elements.push(container('audit_service', { name: 'Audit Service' }), db('audit_db', { name: 'Audit DB' }));
    s.rels.push(rel('audit_service', 'audit_db', 'Writes'));
    const issue = checkConnectivity(s, C4Level.CONTAINER).errors.find((i) => i.code === ConnectivityCode.DISCONNECTED_GRAPH);
    expect(issue?.elementIds.sort()).toEqual(['audit_db', 'audit_service']);
    expect(checkConnectivity(goodMicroservices(), C4Level.CONTAINER).errors).toEqual([]);
  });

  it('C3 DB_WITHOUT_OWNER: a database linked only to a person is an error', () => {
    const s = spec([element('admin', C4ElementKind.PERSON), container('api', { name: 'API' }), db('db')], [rel('admin', 'api'), rel('admin', 'db', 'Queries')]);
    expect(codes(checkConnectivity(s, C4Level.CONTAINER)).errors).toContain(ConnectivityCode.DB_WITHOUT_OWNER);
    s.rels.push(rel('api', 'db', 'Reads'));
    expect(codes(checkConnectivity(s, C4Level.CONTAINER)).errors).not.toContain(ConnectivityCode.DB_WITHOUT_OWNER);
  });

  it('C4 SERVICE_WITHOUT_DB: a microservice without its own database is a warning; a monolith is not checked', () => {
    const s = goodMicroservices();
    s.elements.push(container('shipping_service', { name: 'Shipping Service' }));
    s.rels.push(rel('gateway', 'shipping_service', 'Routes'));
    expect(checkConnectivity(s, C4Level.CONTAINER).warnings.find((i) => i.code === ConnectivityCode.SERVICE_WITHOUT_DB)?.elementIds).toEqual(['shipping_service']);
    const monolith = spec([element('u', C4ElementKind.PERSON), container('api', { name: 'API' })], [rel('u', 'api')], 'Library');
    expect(codes(checkConnectivity(monolith, C4Level.CONTAINER)).warnings).not.toContain(ConnectivityCode.SERVICE_WITHOUT_DB);
  });

  it('C5 SHARED_DB: one database used by two services in microservices is a warning', () => {
    const s = goodMicroservices();
    s.rels.push(rel('payment_service', 'order_db', 'Reads orders'));
    const issue = checkConnectivity(s, C4Level.CONTAINER).warnings.find((i) => i.code === ConnectivityCode.SHARED_DB);
    expect(issue?.elementIds).toEqual(['order_db', 'order_service', 'payment_service']);
  });

  it('C6 GATEWAY_COVERAGE: a client calling a service around the gateway is a warning', () => {
    const s = goodMicroservices();
    s.elements.push(container('search_service', { name: 'Search Service' }), db('search_db'));
    s.rels.push(rel('web', 'search_service', 'Searches'), rel('search_service', 'search_db', 'Reads'));
    expect(checkConnectivity(s, C4Level.CONTAINER).warnings.find((i) => i.code === ConnectivityCode.GATEWAY_COVERAGE)?.elementIds).toEqual(['search_service']);
  });

  it('C7 QUEUE_ONE_SIDED: a queue with producers only is an error', () => {
    const s = goodMicroservices();
    s.rels = s.rels.filter((r) => r.label !== 'Consumes OrderPlaced');
    s.rels.push(rel('payment_service', 'events', 'Publishes PaymentDone'));
    expect(checkConnectivity(s, C4Level.CONTAINER).errors.find((i) => i.code === ConnectivityCode.QUEUE_ONE_SIDED)?.elementIds).toEqual(['events']);
    // An arrow from the queue to a service reads as consuming.
    s.rels.push(rel('events', 'order_service', 'Delivers'));
    expect(codes(checkConnectivity(s, C4Level.CONTAINER)).errors).not.toContain(ConnectivityCode.QUEUE_ONE_SIDED);
  });

  it('C8 COMPONENT_NO_OUTBOUND: a component that calls nothing, and no link out of the container, are warnings', () => {
    const comp = (id: string) => element(id, C4ElementKind.COMPONENT, { tech: 'Java', parent: 'api_b' });
    const inside: C4DiagramSpec = {
      title: 'API components',
      elements: [element('api_b', C4ElementKind.CONTAINER_BOUNDARY), comp('controller'), comp('service'), comp('repository'), db('db', { parent: undefined })],
      rels: [rel('controller', 'service'), rel('service', 'repository')],
    };
    const before = checkConnectivity(inside, C4Level.COMPONENT).warnings.filter((i) => i.code === ConnectivityCode.COMPONENT_NO_OUTBOUND);
    expect(before.map((i) => i.elementIds)).toEqual([['repository'], ['controller', 'service', 'repository']]);
    inside.rels.push(rel('repository', 'db', 'Reads/writes'));
    expect(codes(checkConnectivity(inside, C4Level.COMPONENT)).warnings).not.toContain(ConnectivityCode.COMPONENT_NO_OUTBOUND);
  });

  it('C9 MISSING_INSTANCES: internal containers need instances; device apps and external systems do not', () => {
    const s = goodMicroservices();
    s.elements.find((e) => e.id === 'order_service')!.instances = undefined;
    s.elements.push(element('mail', C4ElementKind.SYSTEM, { external: true, name: 'SendGrid' }));
    s.rels.push(rel('order_service', 'mail', 'Sends email'));
    const issue = checkConnectivity(s, C4Level.CONTAINER).warnings.find((i) => i.code === ConnectivityCode.MISSING_INSTANCES);
    expect(issue?.elementIds).toEqual(['order_service']);
  });

  it('C10 MISSING_LAYER: a layered component diagram without the Domain Model is a warning; all four layers pass', () => {
    const comp = (id: string, name: string) => element(id, C4ElementKind.COMPONENT, { name, tech: 'Java', parent: 'api_b' });
    const inside: C4DiagramSpec = {
      title: 'Order Service components',
      elements: [element('api_b', C4ElementKind.CONTAINER_BOUNDARY), comp('order_controller', 'Order Controller'), comp('order_svc', 'Order Service'),
        comp('order_repo', 'Order Repository'), db('db', { parent: undefined })],
      rels: [rel('order_controller', 'order_svc'), rel('order_svc', 'order_repo'), rel('order_repo', 'db', 'Reads/writes')],
    };
    const warning = checkConnectivity(inside, C4Level.COMPONENT).warnings.find((i) => i.code === ConnectivityCode.MISSING_LAYER);
    expect(warning?.message).toMatch(/without Domain Model/);
    inside.elements.push(comp('order_domain', 'Order Domain Model'));
    inside.rels.push(rel('order_svc', 'order_domain', 'Uses'), rel('order_repo', 'order_domain', 'Maps'));
    expect(codes(checkConnectivity(inside, C4Level.COMPONENT)).warnings).not.toContain(ConnectivityCode.MISSING_LAYER);
    // Not a layered diagram (one layer-like component only): not checked.
    const single: C4DiagramSpec = { title: 'Gateway', elements: [element('gw', C4ElementKind.CONTAINER_BOUNDARY), comp('router', 'Router'), comp('auth', 'Auth Filter'), db('db', { parent: undefined })],
      rels: [rel('router', 'auth'), rel('auth', 'db')] };
    expect(codes(checkConnectivity(single, C4Level.COMPONENT)).warnings).not.toContain(ConnectivityCode.MISSING_LAYER);
  });

  it('C11 MISSING_DISCOVERY: microservices without a Discovery Service, or a service not registered, are warnings', () => {
    const s = goodMicroservices();
    s.elements = s.elements.filter((e) => e.id !== 'discovery');
    s.rels = s.rels.filter((r) => r.to !== 'discovery');
    expect(checkConnectivity(s, C4Level.CONTAINER).warnings.find((i) => i.code === ConnectivityCode.MISSING_DISCOVERY)?.elementIds).toEqual(['order_service', 'payment_service']);
    const unregistered = goodMicroservices();
    unregistered.rels = unregistered.rels.filter((r) => !(r.from === 'payment_service' && r.to === 'discovery'));
    expect(checkConnectivity(unregistered, C4Level.CONTAINER).warnings.find((i) => i.code === ConnectivityCode.MISSING_DISCOVERY)?.elementIds).toEqual(['payment_service']);
    // A modular monolith (modules in one process) is not checked.
    const monolith = spec([element('u', C4ElementKind.PERSON), container('order_module', { name: 'Order Module' }), container('payment_module', { name: 'Payment Module' }), db('shared_db')],
      [rel('u', 'order_module'), rel('order_module', 'payment_module'), rel('order_module', 'shared_db'), rel('payment_module', 'shared_db')], 'Shop modular monolith');
    expect(codes(checkConnectivity(monolith, C4Level.CONTAINER)).warnings).not.toContain(ConnectivityCode.MISSING_DISCOVERY);
  });

  it('runs only the rules of the level: context checks orphans and splits, not instances', () => {
    const ctx: C4DiagramSpec = { title: 'Ctx', elements: [element('u', C4ElementKind.PERSON), element('s', C4ElementKind.SYSTEM), element('x', C4ElementKind.SYSTEM, { external: true })], rels: [rel('u', 's')] };
    expect(codes(checkConnectivity(ctx, C4Level.CONTEXT))).toEqual({ errors: [ConnectivityCode.ORPHAN_ELEMENT], warnings: [] });
  });
});

describe('validateDiagram + connectivity (plan 04 §4.1)', () => {
  it('an element that covers a requirement but has no relationship is kept and reported for repair', () => {
    const s = goodMicroservices();
    s.elements.push(container('report_service', { name: 'Report Service', covers: ['R9'] }));
    const v = validateDiagram(s, C4Level.CONTAINER, [], { maxElements: 20 });
    expect(v.spec.elements.some((e) => e.id === 'report_service')).toBe(true);
    expect(v.errors.some((e) => e.startsWith('ORPHAN_ELEMENT:') && e.includes('report_service'))).toBe(true);
    expect(v.connectivity.errors.map((i) => i.code)).toEqual([ConnectivityCode.ORPHAN_ELEMENT]);
  });

  it('an element with no covers and no relationship is pruned, and the prune is a warning (not silent)', () => {
    const s = goodMicroservices();
    s.elements.push(container('cache', { name: 'Cache' }));
    const v = validateDiagram(s, C4Level.CONTAINER, [], { maxElements: 20 });
    expect(v.spec.elements.some((e) => e.id === 'cache')).toBe(false);
    expect(v.errors).toEqual([]);
    expect(v.connectivity.warnings[0]).toMatchObject({ code: ConnectivityCode.ORPHAN_ELEMENT, elementIds: ['cache'] });
  });

  it('DIAGRAM_CONNECTIVITY_CHECK=false: no connectivity findings and no extra errors', () => {
    const s = goodMicroservices();
    s.elements.push(container('report_service', { name: 'Report Service', covers: ['R9'] }));
    const v = validateDiagram(s, C4Level.CONTAINER, [], { maxElements: 20, connectivity: false });
    expect(v.connectivity).toEqual({ errors: [], warnings: [] });
    expect(v.errors).toEqual([]);
  });

  it('instances in a wrong format is an error', () => {
    const s = goodMicroservices();
    s.elements.find((e) => e.id === 'order_service')!.instances = 'many';
    expect(validateDiagram(s, C4Level.CONTAINER, [], { maxElements: 20 }).errors).toEqual([
      "Element 'order_service' has instances \"many\": write a count (\"3\"), a range (\"2..10\") or \"auto\".",
    ]);
  });
});

describe('instances (T7, plan 04 §5.1)', () => {
  it('normalizes what a model writes', () => {
    expect(['3', 3, 'x3', '3 replicas', '2-10', '2 to 10', '2..10', 'AUTO', '', undefined].map(toInstances))
      .toEqual(['3', '3', '3', '3', '2..10', '2..10', '2..10', 'auto', undefined, undefined]);
    const parsed = toDiagramSpec({ elements: [{ id: 'api', kind: 'container', instances: '2-6', scaling: 'HPA' }, { id: 'db', kind: 'database', replicas: 2 }] });
    expect(parsed.elements.map((e) => [e.instances, e.scaling])).toEqual([['2..6', C4Scaling.HPA], ['2', undefined]]);
  });

  it('shows a count in the box name and a range as a description line', () => {
    const s = goodMicroservices();
    s.elements.find((e) => e.id === 'order_service')!.instances = '3';
    Object.assign(s.elements.find((e) => e.id === 'payment_service')!, { instances: '2..10', scaling: C4Scaling.HPA });
    const puml = new C4PumlBuilder({ includeBase: 'stdlib' }).build(s, C4Level.CONTAINER);
    expect(puml).toContain('Container(order_service, "Order Service x 3", "Spring Boot", "order_service desc")');
    expect(puml).toContain('Container(payment_service, "Payment Service", "Spring Boot", "payment_service desc\\nInstances: 2..10 (HPA)")');
  });
});

describe('PlantUML connectivity lint for chat answers (plan 04 §4.3)', () => {
  const block = (extra = '') => `@startuml
!include <C4/C4_Container>
Person(customer, "Customer", "Buys")
System_Boundary(shop, "Shop") {
  Container(web, "Web", "React", "UI")
  Container(order_service, "Order Service", "Spring", "Orders")
  ContainerDb(order_db, "Order DB", "PostgreSQL", "Orders")
  ContainerQueue(bus, "Kafka", "Kafka", "Events")
  Container(report_service, "Report Service", "Node", "Reports")
}
Rel(customer, web, "Uses", "HTTPS")
Rel_D(web, order_service, "Calls", "REST")
Rel(order_service, order_db, "Reads/writes")
Rel(order_service, bus, "Publishes")
${extra}
@enduml`;

  it('finds the orphan alias and the one-sided queue; boundaries are not elements', () => {
    const report = lintPlantUmlConnectivity(block());
    expect(report.errors.map((i) => [i.code, i.elementIds])).toEqual([
      [ConnectivityCode.ORPHAN_ELEMENT, ['report_service']],
      [ConnectivityCode.QUEUE_ONE_SIDED, ['bus']],
    ]);
  });

  it('a fully connected block is clean; a non-C4 block is not linted', () => {
    expect(lintPlantUmlConnectivity(block('Rel(report_service, bus, "Consumes")')).errors).toEqual([]);
    expect(lintPlantUmlConnectivity('@startuml\nAlice -> Bob: hi\n@enduml')).toEqual({ errors: [], warnings: [] });
  });
});

describe('discussion frame T1–T7 (plan 04 §5.3)', () => {
  it('reorders topics, maps numbered and keyword headings, fills a missing topic without a model call', () => {
    const framed = ensureDiscussionFrame([
      'Tổng quan ngắn.',
      '## 3. Resilience',
      'Kafka giữa Order và Payment.',
      '### Security',
      'OAuth2 qua Keycloak.',
      '## 1) Cloud',
      'Mọi thứ lên AWS.',
      '## Triển khai',
      'Canary.',
      '## Multi-tenancy',
      'Not needed: một tổ chức.',
      '## Instance và scaling',
      'API x 3.',
    ].join('\n'));
    const headings = framed.split('\n').filter((l) => l.startsWith('## '));
    expect(headings).toEqual(DISCUSSION_SECTIONS.map((s) => s.heading));
    expect(framed.startsWith('Tổng quan ngắn.')).toBe(true);
    expect(framed).toContain(`${DISCUSSION_SECTIONS[3].heading}\n\n${DISCUSSION_PLACEHOLDER}`);
    expect(discussionTopicsPresent(framed)).toEqual([1, 2, 3, 5, 6, 7]);
  });
});
