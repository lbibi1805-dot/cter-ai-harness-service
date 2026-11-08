---
id: skill.c4.level-container
version: 1.0.0
owner: c4
description: Rules for the container level (copy of LEVEL_RULES.container)
order: 10
---

[container] One "system_boundary" for the system; its containers have "parent" = that boundary id. People and external
  systems stay outside (no parent). Databases: kind "container" + variant "db"; brokers: variant "queue". No components.
