import {
  CLIENT_APP_PATTERN,
  CONNECTIVITY_ERROR_CODES,
  CONNECTIVITY_RULES_BY_LEVEL,
  CONSUMER_LABEL_PATTERN,
  DATABASE_PATTERN,
  DATALESS_SERVICE_PATTERN,
  DISCOVERY_PATTERN,
  GATEWAY_PATTERN,
  LAYER_PATTERNS,
  MICROSERVICE_PATTERN,
  MODULAR_MONOLITH_PATTERN,
  ON_DEVICE_PATTERN,
  PRODUCER_LABEL_PATTERN,
} from './constants/connectivity.constants';
import { C4ElementKind, C4ElementVariant, ConnectivityCode, type C4Level } from './enums/c4.enums';
import { isBoundary } from './helpers/c4.helper';
import type { C4DiagramSpec, ConnectivityIssue, ConnectivityReport } from './interfaces/c4.interface';

/** One box of the graph the rules run on (a spec element or a PlantUML macro). */
export interface ConnectivityNode {
  id: string;
  kind: C4ElementKind;
  variant: C4ElementVariant;
  external: boolean;
  /** id + name + tech + desc, lower-case: what the role heuristics read. */
  text: string;
  instances?: string;
  /** Enclosing boundary id (component level: inside the focused container or not). */
  parent?: string;
}

export interface ConnectivityEdge {
  from: string;
  to: string;
  label: string;
}

export interface ConnectivityGraph {
  nodes: ConnectivityNode[];
  edges: ConnectivityEdge[];
  /** Diagram-wide text (title + every element), for the "is this a microservice design" signal. */
  text: string;
}

export function emptyConnectivity(): ConnectivityReport {
  return { errors: [], warnings: [] };
}

/** C1–C11 on a validated spec (boundaries are not nodes; rules per level as in plan 04 §4.2). */
export function checkConnectivity(spec: C4DiagramSpec, level: C4Level): ConnectivityReport {
  const nodes: ConnectivityNode[] = spec.elements.filter((e) => !isBoundary(e.kind)).map((e) => ({
    id: e.id,
    kind: e.kind,
    variant: e.variant,
    external: e.external,
    text: [e.id.replace(/_/g, ' '), e.name, e.tech, e.desc].filter(Boolean).join(' ').toLowerCase(),
    instances: e.instances,
    parent: e.parent,
  }));
  const edges = spec.rels.map((r) => ({ from: r.from, to: r.to, label: r.label.toLowerCase() }));
  const text = [spec.title, ...nodes.map((n) => n.text)].join(' ').toLowerCase();
  return checkGraph({ nodes, edges, text }, CONNECTIVITY_RULES_BY_LEVEL[level]);
}

/** Runs the given rules on a graph; error codes go to `errors`, the rest to `warnings`. */
export function checkGraph(graph: ConnectivityGraph, rules: ReadonlySet<ConnectivityCode>): ConnectivityReport {
  const ids = new Set(graph.nodes.map((n) => n.id));
  const edges = graph.edges.filter((e) => ids.has(e.from) && ids.has(e.to) && e.from !== e.to);
  const ctx = new GraphContext(graph.nodes, edges, graph.text);
  const issues: ConnectivityIssue[] = [];
  const run = (code: ConnectivityCode, check: () => ConnectivityIssue[]) => {
    if (rules.has(code)) issues.push(...check());
  };
  run(ConnectivityCode.ORPHAN_ELEMENT, () => ctx.orphans());
  run(ConnectivityCode.DISCONNECTED_GRAPH, () => ctx.disconnected());
  run(ConnectivityCode.DB_WITHOUT_OWNER, () => ctx.dbWithoutOwner());
  run(ConnectivityCode.SERVICE_WITHOUT_DB, () => ctx.serviceWithoutDb());
  run(ConnectivityCode.SHARED_DB, () => ctx.sharedDb());
  run(ConnectivityCode.GATEWAY_COVERAGE, () => ctx.gatewayCoverage());
  run(ConnectivityCode.QUEUE_ONE_SIDED, () => ctx.queueOneSided());
  run(ConnectivityCode.COMPONENT_NO_OUTBOUND, () => ctx.componentNoOutbound());
  run(ConnectivityCode.MISSING_INSTANCES, () => ctx.missingInstances());
  run(ConnectivityCode.MISSING_LAYER, () => ctx.missingLayer());
  run(ConnectivityCode.MISSING_DISCOVERY, () => ctx.missingDiscovery());
  return {
    errors: issues.filter((i) => CONNECTIVITY_ERROR_CODES.has(i.code)),
    warnings: issues.filter((i) => !CONNECTIVITY_ERROR_CODES.has(i.code)),
  };
}

/** `CODE: message` lines, as the repair agent and the critic read them. */
export function describeConnectivity(issues: readonly ConnectivityIssue[]): string[] {
  return issues.map((i) => `${i.code}: ${i.message}`);
}

function issue(code: ConnectivityCode, message: string, elementIds: string[]): ConnectivityIssue {
  return { code, message, elementIds };
}

function list(ids: readonly string[]): string {
  return ids.map((id) => `'${id}'`).join(', ');
}

/** Adjacency and role heuristics shared by the rules. */
class GraphContext {
  private readonly byId: Map<string, ConnectivityNode>;
  private readonly neighbours = new Map<string, Set<string>>();

  constructor(
    private readonly nodes: ConnectivityNode[],
    private readonly edges: ConnectivityEdge[],
    private readonly text: string,
  ) {
    this.byId = new Map(nodes.map((n) => [n.id, n]));
    for (const n of nodes) this.neighbours.set(n.id, new Set());
    for (const e of edges) {
      this.neighbours.get(e.from)!.add(e.to);
      this.neighbours.get(e.to)!.add(e.from);
    }
  }

  private linked(id: string): boolean {
    return (this.neighbours.get(id)?.size ?? 0) > 0;
  }

  private isDb(n: ConnectivityNode): boolean {
    return n.variant === C4ElementVariant.DB || (n.external && n.kind === C4ElementKind.SYSTEM && DATABASE_PATTERN.test(n.text));
  }

  private isQueue(n: ConnectivityNode): boolean {
    return n.variant === C4ElementVariant.QUEUE;
  }

  private isGateway(n: ConnectivityNode): boolean {
    return n.kind === C4ElementKind.CONTAINER && !n.external && n.variant === C4ElementVariant.STANDARD && GATEWAY_PATTERN.test(n.text);
  }

  private isClientApp(n: ConnectivityNode): boolean {
    return n.kind === C4ElementKind.CONTAINER && n.variant === C4ElementVariant.STANDARD && CLIENT_APP_PATTERN.test(n.text) && !this.isGateway(n);
  }

  private isClient(n: ConnectivityNode): boolean {
    return n.kind === C4ElementKind.PERSON || this.isClientApp(n);
  }

  /** An internal backend container that may own data. */
  private isBackendService(n: ConnectivityNode): boolean {
    return n.kind === C4ElementKind.CONTAINER && !n.external && n.variant === C4ElementVariant.STANDARD
      && !this.isGateway(n) && !this.isClientApp(n);
  }

  private microservices(): boolean {
    const dbs = this.nodes.filter((n) => this.isDb(n)).length;
    return MICROSERVICE_PATTERN.test(this.text) || dbs >= 2;
  }

  orphans(): ConnectivityIssue[] {
    return this.nodes.filter((n) => !this.linked(n.id)).map((n) => issue(
      ConnectivityCode.ORPHAN_ELEMENT,
      `'${n.id}' has no relationship: connect it (labelled, with direction and purpose) to the element it uses or that uses it, or remove it.`,
      [n.id],
    ));
  }

  /** Clusters of the undirected graph without the orphans (C1 reports those). */
  disconnected(): ConnectivityIssue[] {
    const seen = new Set<string>();
    const clusters: string[][] = [];
    for (const start of this.nodes.filter((n) => this.linked(n.id))) {
      if (seen.has(start.id)) continue;
      const cluster: string[] = [];
      const stack = [start.id];
      seen.add(start.id);
      while (stack.length > 0) {
        const id = stack.pop()!;
        cluster.push(id);
        for (const next of this.neighbours.get(id) ?? []) {
          if (!seen.has(next)) {
            seen.add(next);
            stack.push(next);
          }
        }
      }
      clusters.push(cluster);
    }
    if (clusters.length < 2) return [];
    clusters.sort((a, b) => b.length - a.length);
    const detached = clusters.slice(1).flat();
    return [issue(
      ConnectivityCode.DISCONNECTED_GRAPH,
      `The diagram falls apart into ${clusters.length} separate groups (${clusters.map((c) => `[${c.join(', ')}]`).join(' | ')}): add the relationships that join them to the main group.`,
      detached,
    )];
  }

  dbWithoutOwner(): ConnectivityIssue[] {
    return this.nodes
      .filter((n) => n.variant === C4ElementVariant.DB && this.linked(n.id))
      .filter((n) => ![...this.neighbours.get(n.id)!].some((id) => {
        const other = this.byId.get(id)!;
        return !this.isDb(other) && other.kind !== C4ElementKind.PERSON;
      }))
      .map((n) => issue(
        ConnectivityCode.DB_WITHOUT_OWNER,
        `Database '${n.id}' is not used by any service or component: connect it to the container/component that owns it.`,
        [n.id],
      ));
  }

  serviceWithoutDb(): ConnectivityIssue[] {
    if (!this.microservices()) return [];
    return this.nodes
      .filter((n) => this.isBackendService(n) && !DATALESS_SERVICE_PATTERN.test(n.text))
      .filter((n) => ![...this.neighbours.get(n.id)!].some((id) => this.isDb(this.byId.get(id)!)))
      .map((n) => issue(
        ConnectivityCode.SERVICE_WITHOUT_DB,
        `Microservice '${n.id}' has no database of its own: add its database and connect it only to this service (or say why it holds no data).`,
        [n.id],
      ));
  }

  sharedDb(): ConnectivityIssue[] {
    if (!this.microservices()) return [];
    return this.nodes.filter((n) => this.isDb(n)).flatMap((db) => {
      const users = [...this.neighbours.get(db.id)!].filter((id) => this.isBackendService(this.byId.get(id)!));
      return users.length >= 2
        ? [issue(ConnectivityCode.SHARED_DB, `Database '${db.id}' is shared by ${list(users)}: in microservices every service owns its own database.`, [db.id, ...users])]
        : [];
    });
  }

  gatewayCoverage(): ConnectivityIssue[] {
    const gateways = new Set(this.nodes.filter((n) => this.isGateway(n)).map((n) => n.id));
    if (gateways.size === 0) return [];
    return this.nodes
      .filter((n) => this.isBackendService(n))
      .filter((n) => [...this.neighbours.get(n.id)!].some((id) => this.isClient(this.byId.get(id)!)))
      .filter((n) => ![...this.neighbours.get(n.id)!].some((id) => gateways.has(id)))
      .map((n) => issue(
        ConnectivityCode.GATEWAY_COVERAGE,
        `Clients reach '${n.id}' directly although the design has a gateway (${list([...gateways])}): route the call through the gateway and link the gateway to '${n.id}'.`,
        [n.id],
      ));
  }

  queueOneSided(): ConnectivityIssue[] {
    return this.nodes.filter((n) => this.isQueue(n) && this.linked(n.id)).flatMap((queue) => {
      let producers = 0;
      let consumers = 0;
      for (const e of this.edges) {
        if (e.to === queue.id) {
          if (CONSUMER_LABEL_PATTERN.test(e.label) && !PRODUCER_LABEL_PATTERN.test(e.label)) consumers++;
          else producers++;
        } else if (e.from === queue.id) {
          if (PRODUCER_LABEL_PATTERN.test(e.label) && !CONSUMER_LABEL_PATTERN.test(e.label)) producers++;
          else consumers++;
        }
      }
      if (producers > 0 && consumers > 0) return [];
      const missing = producers === 0 ? 'producer (a service that publishes to it)' : 'consumer (a service that reads from it)';
      return [issue(ConnectivityCode.QUEUE_ONE_SIDED, `Queue '${queue.id}' has no ${missing}: link both the producer and the consumer to it.`, [queue.id])];
    });
  }

  componentNoOutbound(): ConnectivityIssue[] {
    const components = this.nodes.filter((n) => n.kind === C4ElementKind.COMPONENT);
    if (components.length === 0) return [];
    const issues = components
      .filter((c) => this.linked(c.id) && !this.edges.some((e) => e.from === c.id))
      .map((c) => issue(
        ConnectivityCode.COMPONENT_NO_OUTBOUND,
        `Component '${c.id}' calls nothing: draw its outgoing dependency (another component, a container such as its database, or an external system).`,
        [c.id],
      ));
    const inside = new Set(components.map((c) => c.id));
    const reachesOut = this.edges.some((e) => inside.has(e.from) && !inside.has(e.to) && this.byId.get(e.to)!.kind !== C4ElementKind.PERSON);
    if (!reachesOut) {
      issues.push(issue(
        ConnectivityCode.COMPONENT_NO_OUTBOUND,
        'No component links out of the focused container: show the calls from its components to the other containers and external systems it uses.',
        components.map((c) => c.id),
      ));
    }
    return issues;
  }

  missingInstances(): ConnectivityIssue[] {
    const missing = this.nodes.filter((n) => n.kind === C4ElementKind.CONTAINER && !n.external && !n.instances && !ON_DEVICE_PATTERN.test(n.text));
    return missing.length === 0 ? [] : [issue(
      ConnectivityCode.MISSING_INSTANCES,
      `No "instances" on ${list(missing.map((n) => n.id))}: give each container its instance count ("3") or autoscaling range ("2..10").`,
      missing.map((n) => n.id),
    )];
  }

  /** C10 (14/11 plan 02 L1): a layered component diagram (a controller, service or repository drawn) has all four layers. */
  missingLayer(): ConnectivityIssue[] {
    const components = this.nodes.filter((n) => n.kind === C4ElementKind.COMPONENT);
    const has = LAYER_PATTERNS.map(({ layer, pattern }) => ({ layer, present: components.some((c) => pattern.test(c.text)) }));
    const layered = has.filter((h) => h.present).length >= 2;
    const missing = has.filter((h) => !h.present).map((h) => h.layer);
    return !layered || missing.length === 0 ? [] : [issue(
      ConnectivityCode.MISSING_LAYER,
      `Layered component diagram without ${missing.join(', ')}: show all four layers Controller → Service → Domain Model ← Repository (Repository → database); never fold the Domain Model into the Service or Repository.`,
      components.map((c) => c.id),
    )];
  }

  /** C11 (14/11 plan 02 L2): a microservice design has a Discovery Service that every service registers with and the gateway resolves through. */
  missingDiscovery(): ConnectivityIssue[] {
    if (!this.microservices() || MODULAR_MONOLITH_PATTERN.test(this.text)) return [];
    const discovery = this.nodes.filter((n) => n.kind === C4ElementKind.CONTAINER && DISCOVERY_PATTERN.test(n.text));
    const services = this.nodes.filter((n) => this.isBackendService(n) && !DATALESS_SERVICE_PATTERN.test(n.text));
    if (services.length < 2) return [];
    if (discovery.length === 0) {
      return [issue(
        ConnectivityCode.MISSING_DISCOVERY,
        'Microservice design without a "Discovery Service": add it, link every service to it ("Registers / sends heartbeat") and the gateway to it ("Resolves service instances").',
        services.map((n) => n.id),
      )];
    }
    const ids = new Set(discovery.map((n) => n.id));
    const callers = [...services, ...this.nodes.filter((n) => this.isGateway(n))];
    const unlinked = callers.filter((n) => ![...this.neighbours.get(n.id)!].some((id) => ids.has(id)));
    return unlinked.length === 0 ? [] : [issue(
      ConnectivityCode.MISSING_DISCOVERY,
      `${list(unlinked.map((n) => n.id))} not linked to ${list([...ids])}: every service registers with the Discovery Service and the gateway resolves service instances through it.`,
      unlinked.map((n) => n.id),
    )];
  }
}
