import { PromptCacheLayout } from '../enums/promptLayout.enums';

export const DEFAULT_PROMPT_CACHE_LAYOUT = PromptCacheLayout.V2;

/**
 * The citation rules restrict answers to [RETRIEVED CONTEXT]; this conversation's own turns,
 * images and artifacts are a valid source too (the user's exam statement, their C4 design).
 * The model must say which artifact it used (note 17 §3.5): a wrong pick becomes visible.
 * Static text: part of the cacheable prefix in layout V2.
 */
export const CONVERSATION_SOURCE_RULE = 'Ngoài [RETRIEVED CONTEXT], các turn trước của hội thoại này, ảnh người dùng gửi và [CONVERSATION ARTIFACTS] cũng là nguồn hợp lệ: khi câu hỏi nói về đề bài, ảnh, thiết kế hay điều đã trao đổi trước đó, hãy trả lời từ các nguồn này (không cần có trong tài liệu) và nói rõ là lấy từ hội thoại. Khi dùng một artifact của hội thoại, mở đầu câu trả lời bằng đúng 1 dòng ngắn nêu artifact đã dùng, ví dụ: "Dựa trên [A7] C4 container · Hệ thống đặt vé (turn 3)".';

/**
 * A diagram edited in plain chat (not the /c4 workflow): the complete source in one ```plantuml fence, so the client
 * can render it (POST /api/c4/render) and the turn stores it as a c4_puml artifact. Static: cacheable.
 */
export const DIAGRAM_EDIT_RULE = 'Khi người dùng nhờ sửa một sơ đồ đã có trong hội thoại (C4/PlantUML), trả về TOÀN BỘ mã PlantUML đã sửa trong đúng 1 khối ```plantuml (từ @startuml đến @enduml, không cắt bớt), kèm danh sách gạch đầu dòng ngắn các thay đổi; nếu người dùng cần bản sửa được kiểm tra và vẽ lại đầy đủ, gợi ý dùng lệnh /c4.';

/** Static anchor (V2): memory is no longer in the system prompt, tell the model where it is. */
export const CONVERSATION_MEMORY_ANCHOR = 'Phần ## CONVERSATION MEMORY (danh sách artifact của hội thoại) nằm ở tin nhắn cuối, trước câu hỏi; tóm tắt các turn trước (nếu có) là tin nhắn đầu tiên của lịch sử.';

/** First history turn in V2 (layer ②). */
export const SUMMARY_TURN_HEADER = '[SUMMARY OF EARLIER TURNS]';

/** Assistant turn after the summary so roles keep alternating (static: cacheable). */
export const SUMMARY_TURN_ACK = 'Đã nắm phần tóm tắt các turn trước.';

/**
 * Marker placed before an image an assistant turn produced (C4 PNG). Assistant roles cannot carry images on
 * every provider, so the image goes at the start of the next user turn (same layout for every provider).
 */
export function assistantImageMarker(alias: string | undefined): string {
  return alias ? `[Hình [${alias}] do trợ lý vẽ ở lượt trước]` : '[Hình do trợ lý vẽ ở lượt trước]';
}
