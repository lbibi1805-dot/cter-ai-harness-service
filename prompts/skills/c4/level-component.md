---
id: skill.c4.level-component
version: 1.2.0
owner: c4
description: Rules for the component level (copy of LEVEL_RULES.component)
order: 10
---

[component] One "container_boundary" for the most important container (usually the backend API); its components have
  "parent" = that boundary id. Components only for responsibilities a requirement needs (controller/service per feature area, repository,
  gateway client). Include peer Containers only for direct dependencies: other modules in a modular monolith, or other services in
  microservices. Place each peer outside the focused boundary and draw dependencies from the calling component to the target Container;
  show specified horizontal dependencies between modules/services as well as vertical gateway dependencies; do not show only gateway
  links or invent calls. Do not add peer internals. Every component/layer connects to the other Containers and external systems it uses (outside the
  boundary), each relationship labelled with its direction and purpose; no component is left isolated. In microservices each
  service has its own database, connected only to that service.
