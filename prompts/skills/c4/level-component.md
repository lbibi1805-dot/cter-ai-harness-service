---
id: skill.c4.level-component
version: 1.1.0
owner: c4
description: Rules for the component level (copy of LEVEL_RULES.component)
order: 10
---

[component] One "container_boundary" for the most important container (usually the backend API); its components have
  "parent" = that boundary id. Components only for responsibilities a requirement needs (controller/service per feature area, repository,
  gateway client). Include peer Containers only for direct dependencies: other modules in a modular monolith, or other services in
  microservices. Place each peer outside the focused boundary and draw dependencies from the calling component to the target Container;
  do not add peer internals or invent calls. People or unrelated external systems stay outside.
