---
id: skill.c4.level-container
version: 1.1.0
owner: c4
description: Rules for the container level (copy of LEVEL_RULES.container)
order: 10
---

[container] One "system_boundary" for the system; its containers have "parent" = that boundary id. People and external
  systems stay outside (no parent). Self-hosted databases are kind "container" + variant "db"; managed third-party databases are external systems with external=true. For a modular monolith, create one Container per module even when modules share a process. Brokers: variant "queue". No components.
