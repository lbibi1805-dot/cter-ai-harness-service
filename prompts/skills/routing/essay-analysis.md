---
id: skill.routing.essay-analysis
version: 1.1.0
owner: routing
description: Essay Mode block appended to the intent-router aux prompt (copy of ROUTER_ESSAY_INSTRUCTIONS) — the router call also analyses the exam question
order: 20
---

The request is an exam essay question. In the SAME JSON object also add an "essay" key:
"essay":{"subject":"...","aspects":["..."],"verbs":["explain"],"points":null,"targetWords":null}
- subject: the course topic in a few words.
- aspects: every distinct part the answer must cover, in order, each a short search query in the question's language (1-12).
- verbs: the instruction verbs, mapped to list | explain | analyze | compare | evaluate.
- points: the marks of the question when stated (e.g. "(2 điểm)" -> 2), else null.
- targetWords: expected length in words when the question states one, else null.
