---
id: skill.c4.level-component
version: 1.0.0
owner: c4
description: Rules for the component level (copy of LEVEL_RULES.component)
order: 10
---

[component] One "container_boundary" for the most important container (usually the backend API); its components have
  "parent" = that boundary id. Components only for responsibilities a requirement needs (controller/service per feature area, repository,
  gateway client). Neighbouring containers, people or external systems stay outside.
