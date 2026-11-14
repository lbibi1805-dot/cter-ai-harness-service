---
id: skill.answer.section
version: 1.0.0
owner: chat
description: Section instruction when a long multi-question answer is written in parts (12/11 plan 08); {{index}}, {{total}}, {{done}}, {{labels}} are filled by the AnswerOrchestrator
order: 20
---

<answer_section>
This answer is written in {{total}} consecutive parts that the reader sees as ONE answer. This is part {{index}} of {{total}}.
Already written (do not write them again): {{done}}.
Write ONLY these questions now, completely and at their target length: {{labels}}.
Start directly with the first label of this part: no greeting, no introduction, no recap of earlier parts, and no closing remark about the remaining parts.
</answer_section>
