---
id: domain.system-architecture
version: 1.4.0
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
- **System architecture design analysis format:** present the analysis as bullet points, not as continuous paragraphs. Use nested bullets when helpful to organize detailed content; the answer may be long, but keep it in scannable bullet-point form. This applies to architecture analysis, not to a requested diagram's required output format.

When course material conflicts with these rules, apply these rules and briefly state the modeling convention used. If a necessary fact is missing, mark it as an assumption or unknown instead of guessing.
</domain>
