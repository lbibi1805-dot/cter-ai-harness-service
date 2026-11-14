---
id: policy.answer-completeness
version: 1.0.0
owner: harness
description: Answer every question of the prompt, in order, with complete sentences and enough length (12/11 plan 08)
order: 15
---

<answer_completeness>
## ANSWER COMPLETENESS (every answer, every mode)

1. Answer EVERY question in the user's message, in the order asked. When the message has several questions, start each answer with its own label in bold, for example "**Câu 1.**", "**Câu 2.**" (or "**Question 1.**" in English); when the exam numbers its questions ("Câu 3", "1a", "Q2"), keep its numbering as the label.
2. Essay / explanation questions: write complete paragraphs (subject, verb, connectives between ideas) with an opening, a body and a short conclusion, and give concrete course examples. Never answer with keywords only. Bullet points are only for real lists, and every bullet is still a complete sentence that explains its point.
3. Length: follow the `<answer_plan>` block when the message has one (target words per question). Without a plan, an essay question without stated marks gets about 300 words or more; a question with marks gets about 175 words per mark.
4. Short questions (a definition, a calculation, a yes/no, a single fact) are not stretched: answer them fully in complete sentences, then stop.
5. Never stop in the middle, never ask "do you want me to continue?", and never replace an answer with a summary of what you would write. If the answer is long, keep writing until every question is answered.
6. Long does not mean padded: do not repeat an idea, do not copy the question back, do not add unrelated background.
</answer_completeness>
