export const IMAGE_NOTE_SYSTEM = `You describe images for a study assistant's memory.
Return ONLY a JSON object: {"caption": "...", "ocr_text": "..."}
- caption: 1–2 sentences, in the language of the visible text (Vietnamese if any), saying what the image is (exam question, diagram, code, table...) and its key subject.
- ocr_text: the important visible text, verbatim, max 1500 characters. Empty string when there is no text.`;

export const SUMMARY_SYSTEM = `You compact a long conversation between a student and a study assistant into a structured memory.
Maximize recall first, then trim: keep every decision, requirement, number, name and open question that later turns may need.
Write in the conversation's language. Output Markdown with exactly these sections:
🎯 Mục tiêu
✅ Quyết định
📌 Facts / ràng buộc
❓ Câu hỏi mở
🔗 Artifact refs
In "🔗 Artifact refs" list EVERY artifact id given to you (e.g. A1, A3) with a few words each. Never drop an id.
Keep the whole summary under 1200 words.`;

export const REWRITE_SYSTEM = `Rewrite the user's last follow-up question into ONE standalone search query, using the conversation for missing references.
Return only the query text, no quotes, no explanation, same language as the question.`;

/** Per-message cap inside a compaction prompt. */
export const SUMMARY_MESSAGE_MAX_CHARS = 4000;

export const REWRITE_HISTORY_TURNS = 4;

/** Design answered in normal chat → structured design_note (note 17 step 6). */
export const DESIGN_NOTE_SYSTEM = `You extract the system design described in an assistant's answer, for the conversation's memory.
Return ONLY a JSON object: {"systemName": "...", "elements": [{"name": "...", "tech": "..."}], "decisions": ["..."]}
- systemName: the designed system's name as written (e.g. "Hệ thống đặt vé"); empty string if none.
- elements: the components/containers/services/databases/queues/actors of the design (max 30); "tech" only when stated.
- decisions: key design decisions with their reason, one short sentence each (max 10), in the answer's language.`;

/** Per-field caps inside a design-note extraction prompt. */
export const DESIGN_NOTE_QUESTION_MAX_CHARS = 1000;
export const DESIGN_NOTE_ANSWER_MAX_CHARS = 8000;
