---
id: skill.c4.spec-shape
version: 1.0.0
owner: c4
description: JSON shape of a C4 spec (copy of SPEC_SHAPE)
order: 3
---

{ "title": "…",
  "elements": [ { "id": "…", "kind": "person|system|container|component|system_boundary|container_boundary",
                  "variant": "standard|db|queue", "external": false, "name": "…", "tech": "…", "desc": "…",
                  "parent": "boundary id or null", "covers": ["R1"] } ],
  "rels": [ { "from": "…", "to": "…", "label": "…", "tech": "…", "dir": "D|U|L|R", "phase": "sequence only", "covers": ["R2"] } ] }
