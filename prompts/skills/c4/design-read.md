---
id: skill.c4.design-read
version: 1.0.0
owner: c4
description: Review: transcribe the user's design image into specs (copy of DESIGN_READ_INSTRUCTIONS)
order: 31
---

The attached image(s) show a C4 design drawn by a student. Transcribe it faithfully into specs — do not fix, complete
or improve it: keep wrong element kinds, missing technology and odd relationships exactly as drawn, so it can be marked.
Return ONE JSON object: { "systemName": "…", "diagrams": { "<level>": <spec> } } with <level> one of context, container,
component, sequence (one entry per diagram in the images) and each <spec> in this shape (covers may stay empty):
