---
id: skill.c4.level-sequence
version: 1.0.0
owner: c4
description: Rules for the sequence level (copy of LEVEL_RULES.sequence)
order: 10
---

[sequence] The single most important end-to-end flow. Participants are a FLAT list: no boundaries, no parent,
  external=false. Relationships are messages in time order (array order = top to bottom); include a reply only when it carries meaning;
  optional "phase" groups consecutive messages under a step heading. About 12 messages at most.
