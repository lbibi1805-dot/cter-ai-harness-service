---
id: skill.c4.universal-rules
version: 1.1.0
owner: c4
description: Rules for every C4 diagram (copy of UNIVERSAL_RULES)
order: 4
---

Rules for every diagram:
- ids: lower_snake_case ASCII (letters, digits, _), unique within a diagram; reuse the same id for the same thing across diagrams.
- Every element and relationship lists in "covers" the requirement ids it demonstrates. An element with empty "covers" must still
  be an endpoint of a relationship that covers something; otherwise leave it out.
- Every relationship has a short verb label; add "tech" (protocol) at container/component level.
- Containers and components ALWAYS have "tech". People always have external=false.
- Internal containers have "instances": a count ("3"), an autoscaling range ("2..10") or "auto"; add "scaling"
  ("fixed", "hpa" or "serverless") when known. People, external systems and components have no "instances".
- Connectivity (the connectivity rules above): every element has at least one relationship and the diagram is one
  connected graph; each database links to the service that owns it; each queue has a producer and a consumer.
- "dir" is a layout hint: "D" from people to the system, "R" towards external systems, "D" towards databases.
  Use it to avoid crossing lines; omit when unsure.
