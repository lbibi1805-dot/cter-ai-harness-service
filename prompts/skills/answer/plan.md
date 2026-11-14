---
id: skill.answer.plan
version: 1.0.0
owner: chat
description: The <answer_plan> block placed after a multi-question prompt (12/11 plan 08); {{questions}} and {{total}} are filled by the AnswerOrchestrator
order: 10
---

<answer_plan>
The message above has {{total}} questions. Answer ALL of them, in this order, each starting with its label in bold:
{{questions}}
"words" is the target length of that answer; "short" means answer fully but briefly, in complete sentences.
</answer_plan>
