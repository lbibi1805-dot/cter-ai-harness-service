import { C4Level, ConnectivityCode } from '../enums/c4.enums';

/** Error codes (go to the repair round); everything else is a warning for the critic (12/11 plan 04 §4.2). */
export const CONNECTIVITY_ERROR_CODES: ReadonlySet<ConnectivityCode> = new Set([
  ConnectivityCode.ORPHAN_ELEMENT,
  ConnectivityCode.DISCONNECTED_GRAPH,
  ConnectivityCode.DB_WITHOUT_OWNER,
  ConnectivityCode.QUEUE_ONE_SIDED,
]);

/** Which rules run at which level (plan 04 §4.2 table); sequence diagrams only need every participant in a message. */
export const CONNECTIVITY_RULES_BY_LEVEL: Readonly<Record<C4Level, ReadonlySet<ConnectivityCode>>> = {
  [C4Level.CONTEXT]: new Set([ConnectivityCode.ORPHAN_ELEMENT, ConnectivityCode.DISCONNECTED_GRAPH]),
  [C4Level.CONTAINER]: new Set([
    ConnectivityCode.ORPHAN_ELEMENT,
    ConnectivityCode.DISCONNECTED_GRAPH,
    ConnectivityCode.DB_WITHOUT_OWNER,
    ConnectivityCode.SERVICE_WITHOUT_DB,
    ConnectivityCode.SHARED_DB,
    ConnectivityCode.GATEWAY_COVERAGE,
    ConnectivityCode.QUEUE_ONE_SIDED,
    ConnectivityCode.MISSING_INSTANCES,
    ConnectivityCode.MISSING_DISCOVERY,
  ]),
  [C4Level.COMPONENT]: new Set([
    ConnectivityCode.ORPHAN_ELEMENT,
    ConnectivityCode.DISCONNECTED_GRAPH,
    ConnectivityCode.DB_WITHOUT_OWNER,
    ConnectivityCode.QUEUE_ONE_SIDED,
    ConnectivityCode.COMPONENT_NO_OUTBOUND,
    ConnectivityCode.MISSING_LAYER,
  ]),
  [C4Level.SEQUENCE]: new Set([ConnectivityCode.ORPHAN_ELEMENT]),
};

/** Element text (id, name, tech, desc; lower-case) that marks an API gateway / edge router. */
export const GATEWAY_PATTERN = /gateway|api[ _-]?gw|\bfiltering\b|reverse[ _-]?proxy|\bnginx\b|\bkong\b|\benvoy\b|\bingress\b|\bbff\b/;

/** Client apps (browser, mobile, desktop): callers of the backend, not services. */
export const CLIENT_APP_PATTERN = /web[ _-]?app|\bspa\b|single[ _-]page|front[ _-]?end|\bmobile\b|\bios\b|android|\bbrowser\b|\bdesktop\b|\breact\b|angular|\bvue\b|next\.?js|flutter|giao diện|ứng dụng di động/;

/** Client apps that run on the user's device (incl. browser SPAs): no server instance count to give. */
export const ON_DEVICE_PATTERN = /\bmobile\b|\bios\b|android|\bbrowser\b|\bdesktop\b|\bspa\b|single[ _-]page|flutter|\breact\b|angular|\bvue\b|ứng dụng di động/;

/** Containers that own no business data (infrastructure, workers): not expected to own a database. */
export const DATALESS_SERVICE_PATTERN = /discovery|registry|eureka|consul|config[ _-]?server|prometheus|grafana|datadog|collector|opentelemetry|\botel\b|\bloki\b|\btempo\b|\bkafka\b|rabbit|broker|\bcache\b|\bworker\b|scheduler|\bcron\b/;

/** External systems that are managed databases (Neon, Supabase…): count as the owning service's database. */
export const DATABASE_PATTERN = /database|\bdb\b|postgres|mysql|mongo|\bneon\b|supabase|dynamo|\bsql\b|cassandra|firestore|cơ sở dữ liệu/;

/** C10: the four N-Tier layers and the component text that marks each (14/11 plan 02 L1). */
export const LAYER_PATTERNS: ReadonlyArray<{ layer: string; pattern: RegExp }> = [
  { layer: 'Controller', pattern: /controller|\bendpoints?\b|\bhandlers?\b|\bresource\b|rest api|\bapi layer\b|presentation/ },
  { layer: 'Service', pattern: /\bservices?\b|use[ _-]?case|application layer|business logic/ },
  { layer: 'Domain Model', pattern: /\bdomain\b|\bentit(?:y|ies)\b|\bmodels?\b|aggregate/ },
  { layer: 'Repository', pattern: /repositor|\brepo\b|\bdao\b|data access|persistence/ },
];

/** C11: the service-discovery container (named `Discovery Service` by the domain rules). */
export const DISCOVERY_PATTERN = /discovery|eureka|consul|service[ _-]?registry|registry[ _-]?service/;

/** A modular monolith: modules share a process, no Discovery Service needed. */
export const MODULAR_MONOLITH_PATTERN = /modular[ _-]?monolith|monolith/;

/** The design calls itself a microservice architecture. */
export const MICROSERVICE_PATTERN = /micro[ _-]?services?/;

/** Relationship labels that read as consuming from a queue (whatever the arrow direction). */
export const CONSUMER_LABEL_PATTERN = /consum|subscri|listen|\bpoll|\bpull|receiv|\bread|nhận|đọc|lắng nghe|tiêu thụ/;

/** Relationship labels that read as producing to a queue. */
export const PRODUCER_LABEL_PATTERN = /publish|produc|\bsend|\bemit|\bpush|enqueue|\bwrite|gửi|phát|đẩy|ghi/;

/** `instances`: a count ("3"), a range ("2..10") or "auto". */
export const INSTANCES_PATTERN = /^(?:\d{1,4}|\d{1,4}\.\.\d{1,4}|auto)$/;

/** Ways a model writes a range ("2-10", "2 – 10", "2 to 10") → "2..10". */
export const INSTANCES_RANGE_INPUT = /^(\d{1,4})\s*(?:\.\.|-|–|to|đến)\s*(\d{1,4})$/i;

/** "x3", "3x", "×3", "3 instances", "3 replicas" → "3". */
export const INSTANCES_COUNT_INPUT = /^(?:[x×]\s*)?(\d{1,4})\s*(?:x|×|instances?|replicas?|pods?)?$/i;
