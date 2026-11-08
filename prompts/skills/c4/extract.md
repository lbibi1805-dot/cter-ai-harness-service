---
id: skill.c4.extract
version: 1.0.0
owner: c4
description: Extraction: problem images + typed text → ProblemBrief JSON (copy of EXTRACT_INSTRUCTIONS)
order: 30
---

Read the problem statement of an exam question about software architecture (C4 model). It is given as images (photos
or screenshots of one or more pages, in order — together they are ONE problem) and/or text typed by the user.
Some images may instead show the user's OWN design (a diagram they drew); report those in "userDesign" and do not
read requirements from them.

Return ONE JSON object:
{ "brief": <brief from everything>, "typed": <brief with ONLY what the typed text states, {} when there is no typed text> }
where <brief> is:
{ "systemName": {"value": "…", "confidence": 0.0},
  "systemBoundary": {"value": "what is inside the system to design", "confidence": 0.0},
  "actors": {"value": ["…"], "confidence": 0.0},
  "externalSystems": {"value": ["…"], "confidence": 0.0},
  "functionalReqs": ["…"], "nonFunctionalReqs": ["…"],
  "techConstraints": {"value": ["…"], "confidence": 0.0},
  "levels": {"value": ["context", "container"], "confidence": 0.0},
  "rubric": [ {"criterion": "…", "weight": 1} ],
  "userDesign": {"present": false, "imageIndexes": []} }
Rules: confidence 0..1 = how clearly the statement says it (0 = not stated at all, guessed). "levels" = the C4 levels
the question asks to draw (context, container, component, sequence); leave [] with confidence 0 when it does not say.
"externalSystems": [] with a high confidence only when the statement clearly has none. imageIndexes are 0-based.
Write values in the language of the statement; requirements short (under 15 words each); do not invent requirements.
