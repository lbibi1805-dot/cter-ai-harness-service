import { ChatApiPath } from '../enums/chat.enums';

const CHAT_TAG = ['Chat'];
const BEARER = [{ bearerAuth: [] }];

const STAGED_IMAGE_SCHEMA = {
  type: 'object',
  required: ['imageId', 'mimeType', 'bytes'],
  properties: {
    imageId: { type: 'string', format: 'uuid' },
    mimeType: { type: 'string', example: 'image/png' },
    bytes: { type: 'integer', description: 'Stored size (after a server-side downscale, if any)' },
    width: { type: 'integer' },
    height: { type: 'integer' },
  },
};

/**
 * Chat paths merged into the served spec (`GET /openapi.json`) when `docs/openapi.json` does not describe them
 * yet (the file stays the source of truth once it does).
 */
export const CHAT_OPENAPI_PATHS: Readonly<Record<string, Record<string, unknown>>> = {
  [ChatApiPath.IMAGES]: {
    post: {
      tags: CHAT_TAG,
      summary: 'Upload-first images: store up to MAX_CHAT_IMAGES images (magic bytes checked, >2048 px downscaled to 1568 px), '
        + 'then send their ids as `imageIds` in POST /api/chat or /api/c4 within CHAT_UPLOAD_TTL_MS. RAM metadata only (no database).',
      security: BEARER,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['images'],
              properties: {
                images: {
                  type: 'array',
                  items: { type: 'object', required: ['data'], properties: { data: { type: 'string', description: 'base64 or data URL' }, mimeType: { type: 'string' } } },
                },
              },
            },
          },
          'image/*': { schema: { type: 'string', format: 'binary' } },
        },
      },
      responses: {
        200: { description: 'Stored', content: { 'application/json': { schema: { type: 'object', properties: { images: { type: 'array', items: STAGED_IMAGE_SCHEMA } } } } } },
        400: { description: 'Not a PNG/JPEG/GIF/WebP image, empty body or too many images' },
        401: { description: 'Missing or wrong CHAT_API_TOKEN' },
        413: { description: 'Body over CHAT_MAX_BODY_MB' },
        503: { description: 'CHAT_API_TOKEN not set, or no object storage' },
      },
    },
  },
};
