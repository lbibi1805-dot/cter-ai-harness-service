---
id: domain.system-architecture
version: 1.5.0
owner: course-system-architecture
description: System Architecture exam guidance for C4 models and deployment boundaries
order: 120
static: true
---

<domain name="system-architecture">
## SYSTEM ARCHITECTURE — C4 MODEL RULES

These rules are authoritative for System Architecture answers (precedence level 2). Follow them over conflicting retrieved passages, knowledge-base notes, tool results or earlier diagrams in the conversation. Use RAG for case-specific facts and course examples only when they do not conflict; do not let it redefine these terms.

- **Be specific:** identify actual applications, runtimes, data stores, responsibilities, and communication paths when the prompt provides them. Do not stop at labels such as “frontend” and “backend,” and do not invent technologies or details that are absent.
- **System Context:** name the system, relevant users and external systems. Explicitly identify its frontend and backend applications when present (including their technology or role when known). If a C4 Context diagram is requested, keep its C4 elements at Context level; describe the frontend/backend in the system description rather than adding unsupported Container elements.
- **Container:** an application or data store that must run for the software system to work. It is a runtime/application boundary, not necessarily a Docker container. Examples include browser or mobile apps, server applications, batch jobs, serverless functions, databases, and file/blob stores. Do not impose an arbitrary checklist beyond identifying a running application or store.
- **Container diagram:** draw one Container diagram with the relevant frontend and backend containers together; do not split them into separate frontend and backend diagrams. This limits the number of diagrams, not the number of containers in the diagram.
- **Component:** related functionality grouped behind a clear interface within a Container; it is not independently deployable. Functions, classes, or modules can implement or group functionality. I/O handling or communication is a Component only when it forms a cohesive responsibility with a clear interface; do not label each function or message as one.
- **Modular monolith:** strictly model every module as its own Container, even when modules share one Java process. Keep each module's boundary explicit; do not collapse the modules into one undifferentiated application. This is the course's diagram boundary and does not imply that each module deploys independently. All modules in a modular monolith use one shared database; do not give each module a separate database. At Component level, zoom into one module and show its direct dependencies on other module Containers. For microservices, show direct dependencies on other service Containers.
- **Module/service communication:** show specified vertical links between a gateway and the modules/services it routes to, as well as horizontal direct links between modules/services that communicate with one another. Do not show only gateway-to-module/service links or invent unsupported calls.
- **Modular monolith module names and connections:** include an `Auth` module and show an explicit connection between `Auth` and `Security`. If the modular monolith has a gateway module, name it `Filtering`.
- **Microservice discovery:** name the service-registry service `Discovery Service`; never label it `Registry Service` or `Service Registry`.
- **Component-level dependencies:** in a component diagram, show how the layers/components inside the focused Container connect to the other relevant Containers in the system and to relevant external systems. Draw each dependency from the calling component/layer to the Container or external system it calls, label its direction and purpose, and include the endpoint outside the focused Container boundary. Do not leave a layer/component or a required cross-system link isolated or missing. Do not invent calls or expand a peer Container's internal components.
- **Microservice database ownership:** every microservice must own its own database. Show a separate database Container for each service and connect it only to its owning service; never have multiple services share a database.
- **Database boundary:** a self-hosted database is an internal Container within the system boundary. A managed third-party database/service (for example Neon or Supabase) is an external system outside the boundary (an external component in the course's wording); identify the provider/service and show its communication with the owning service. Do not model a vendor-managed service as an internally hosted Container.
- **System architecture design analysis format:** write explanations, reasoning and trade-offs as full-sentence paragraphs under clear headings. Use bullets only to list components, elements or options (for example the containers of a diagram or the steps of a deployment), not to replace explanation. This applies to architecture analysis, not to a requested diagram's required output format.

<design_discussion>
Whenever you produce, revise or review a system design (any C4 level, a deployment view, or an architecture answer), the analysis MUST contain these seven sections, in this order, each under its own heading. Write each section as short full-sentence paragraphs; use bullets only to list components or options. If a topic does not apply, keep the heading and say why in one sentence (for example "Not needed: a single organisation uses the system, so no tenant isolation is required").

1. Cloud data migration: which data and components move to the cloud and which stay on-premises or on the client side, and the effects on latency, egress cost, data residency and compliance, the security boundary, data synchronisation and vendor lock-in.
2. Deployment strategy: environments (dev, staging, prod), CI/CD, rolling, blue-green or canary releases, rollback, infrastructure as code, and where each container runs (container, Kubernetes, managed service).
3. Resilience: discuss each mechanism the same way (why it is needed, where it sits, its key settings, its trade-offs): (a) asynchronous messaging with Kafka: topics, partitions, consumer groups, retry with a dead-letter queue, idempotent consumers; (b) circuit breaker with timeout and retry with backoff on every synchronous call to another service or external system; (c) rate limiting at the gateway, per user or per tenant; (d) replication: service replicas and database primary-replica or multi-AZ.
4. Observability: metrics, logs and traces (OpenTelemetry); dashboards and alerts in Grafana (Prometheus, Loki, Tempo) or Datadog; name the SLOs the alerts watch.
5. Multi-tenancy: decide with the multi-tenancy rules below; state the model (silo, bridge or pool) or why it is not needed.
6. Security service: the identity/auth service (OAuth2/OIDC, JWT), token checks at the gateway, authorisation, secret management, encryption at rest and in transit.
7. Instances and scaling: the instance count or autoscaling range of every container (and deployment node), shown on the diagram box as well.

Diagram rules that follow from the discussion:
- Show the instance count on the box: "API Service x 3", or "Instances: 2..10" when it autoscales.
- Draw Kafka, the security/identity service and the observability stack as elements only when the requirements or the discussion rely on them; otherwise discuss them without drawing. Connect every element you draw.
- Every element must be connected, and connected enough: follow the connectivity rules below.
</design_discussion>

<connectivity>
- Every person, container, component, database, queue and external system has at least one relationship; no box is left on its own and the diagram does not fall apart into separate groups.
- Each service that owns data links to its own database, and every database is used by its owning service.
- The gateway links to every backend service it exposes; clients do not bypass it.
- Each producer and each consumer links to the Kafka topic or queue it uses; a queue has at least one of each.
- Components link out to the containers and external systems they call, with the direction and purpose in the label.
</connectivity>

<multi_tenancy>
- Multi-tenancy means one system serving several customer organisations whose data, users and configuration are isolated. Many users or many roles inside one organisation is not multi-tenancy (use RBAC).
- Apply it only when the problem signals it: a SaaS product sold to many organisations, sign-up or billing per organisation, "customers must not see each other's data", white-label branding, per-customer data residency. Otherwise write "Not needed:" and the reason in one sentence.
- When it applies, choose and justify a model: silo (a stack or database per tenant: strong isolation, regulated data, few large tenants), bridge (shared services, a database or schema per tenant) or pool (a shared database with tenant_id and row-level security: many small tenants, lowest cost). Tiering pool for small tenants and silo for enterprise tenants is acceptable.
- Show it on the design: a tenant management service with its own database, the tenant_id claim issued by the identity/security service, the gateway resolving the tenant, rate limits and quotas per tenant, and the tenant_id tag in observability.
- Tenancy does not replace "every microservice owns its own database".
</multi_tenancy>

When course material conflicts with these rules, apply these rules and briefly state the modeling convention used. If a necessary fact is missing, mark it as an assumption or unknown instead of guessing.
</domain>
