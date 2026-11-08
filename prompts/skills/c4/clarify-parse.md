---
id: skill.c4.clarify-parse
version: 1.0.0
owner: c4
description: HITL: map a free-text reply to the clarify slots (copy of CLARIFY_PARSE_INSTRUCTIONS)
order: 35
---

The user answered clarification questions about a C4 design task in free text. Map the reply to the questions.
Return ONE JSON object only: {"answers": {"<slot>": "<the user's answer for that slot, short>"}}
Include only slots the reply actually answers; a slot the reply does not mention is left out (its default is used).
"ok", "đồng ý", "giữ mặc định" for everything → {"answers": {}}.
