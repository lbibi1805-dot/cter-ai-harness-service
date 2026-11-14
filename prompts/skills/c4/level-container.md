---
id: skill.c4.level-container
version: 1.4.0
owner: c4
description: Rules for the container level (copy of LEVEL_RULES.container)
order: 10
---

[container] Produce one Container diagram with the relevant frontend and backend containers together; do not split them
  into separate frontend and backend diagrams. This limits the number of diagrams, not the number of containers in the
  diagram. Show specified vertical links between a gateway and the modules/services it routes to, as well as horizontal
  direct links between modules/services that communicate with one another. Do not show only gateway-to-module/service
  links or invent unsupported calls. One "system_boundary" for the system; its containers have "parent" = that boundary
  id. People and external systems stay outside (no parent). Self-hosted databases are kind "container" + variant "db";
  managed third-party databases are external systems with external=true. For a modular monolith, create one Container
  per module even when modules share a process. Microservices always include a "Discovery Service" container: every
  service registers with it ("Registers / sends heartbeat") and the gateway resolves service instances through it
  ("Resolves service instances"); a modular monolith does not need one. In microservices every service owns its own database (one db container or
  managed external database per service, connected only to its owning service; never shared). Brokers: variant "queue". No components.
  Add a queue/broker, cache, worker or storage only when a requirement or a non-functional requirement (scale, availability,
  asynchronous processing) needs it. Give every internal container "instances" (a count, or an autoscaling range with
  "scaling").
