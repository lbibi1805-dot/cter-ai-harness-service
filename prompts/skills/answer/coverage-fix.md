---
id: skill.answer.coverage-fix
version: 1.0.0
owner: chat
description: One extra call that writes only the questions the answer missed or left too short (12/11 plan 08); {{missing}} is filled by the AnswerOrchestrator
order: 40
---

[COMPLETE THE ANSWER] Your previous answer (the last assistant message) did not fully answer these questions: {{missing}}.
Write ONLY those answers now, each starting with its label in bold and at its target length. Do not repeat or summarize the questions that are already answered, and do not add an introduction.
