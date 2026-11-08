import { C4ApiPath } from '../enums/c4.enums';
import { MAX_RENDER_SOURCE_CHARS } from '../../application/constants/c4Render.constants';

const C4_TAG = ['C4'];
const CHAT_AUTH = [{ bearerAuth: [] }];

/**
 * C4 paths merged into the served spec (`GET /api/openapi.json`) when `docs/openapi.json`
 * does not describe them yet (the file stays the source of truth once it does).
 */
export const C4_OPENAPI_PATHS: Readonly<Record<string, Record<string, unknown>>> = {
  [C4ApiPath.RENDER]: {
    post: {
      tags: C4_TAG,
      summary: 'Xem trước PlantUML: source → PNG (cache RAM theo sha256, không chạm DB/R2). Cần CHAT_API_TOKEN.',
      description: 'Dùng cho khối ```plantuml trong câu trả lời chat (sửa sơ đồ C4 trong chat). Source thiếu @startuml/@enduml được bọc tự động. Bản sửa đã kiểm tra (validator + critic) vẫn đi qua /api/c4 (lệnh /c4).',
      security: CHAT_AUTH,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['source'],
              properties: {
                source: { type: 'string', maxLength: MAX_RENDER_SOURCE_CHARS, example: '@startuml\nPerson(u, "User")\n@enduml' },
                format: { type: 'string', enum: ['png'], default: 'png' },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'PNG; header X-Render-Cache: hit|miss', content: { 'image/png': { schema: { type: 'string', format: 'binary' } } } },
        400: { description: 'Body/ source không hợp lệ' },
        401: { description: 'Thiếu hoặc sai CHAT_API_TOKEN' },
        413: { description: `source dài hơn ${MAX_RENDER_SOURCE_CHARS} ký tự` },
        422: {
          description: 'PlantUML báo lỗi cú pháp',
          content: { 'application/json': { schema: { type: 'object', properties: { error: { type: 'string' }, syntaxError: { type: 'string' }, line: { type: 'integer', nullable: true } } } } },
        },
        502: { description: 'PlantUML server lỗi / không trả lời' },
        503: { description: 'CHAT_API_TOKEN chưa đặt (API tắt)' },
      },
    },
  },
};
