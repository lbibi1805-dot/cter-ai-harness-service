# syntax=docker/dockerfile:1.4
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
# Deps cho chromium / @napi-rs/canvas (pdf render, mermaid)
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    font-noto-emoji \
    && rm -rf /var/cache/apk/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Cai native binding @napi-rs/canvas cho Alpine musl
RUN npm install --omit=dev @napi-rs/canvas-linux-x64-musl@latest

COPY --from=builder /app/dist ./dist
# Copy runtime files neu co trong build context - dung mount de khong fail khi repo chua push vault/manifest (fix Render)
RUN --mount=type=bind,target=/tmp/context,source=. \
    mkdir -p /app/data /app/documents-vault && \
    if [ -f /tmp/context/system-prompt.md ]; then cp /tmp/context/system-prompt.md /app/system-prompt.md; else echo 'You are a helpful assistant.' > /app/system-prompt.md; fi && \
    if [ -f /tmp/context/knowledge.md ]; then cp /tmp/context/knowledge.md /app/knowledge.md; else touch /app/knowledge.md; fi && \
    if [ -f /tmp/context/.vault-manifest.json ]; then cp /tmp/context/.vault-manifest.json /app/.vault-manifest.json && cp /tmp/context/.vault-manifest.json /app/data/.vault-manifest.json; else echo '{"files":{}}' > /app/.vault-manifest.json && echo '{"files":{}}' > /app/data/.vault-manifest.json; fi && \
    if [ -d /tmp/context/documents-vault ]; then cp -r /tmp/context/documents-vault/. /app/documents-vault/ 2>/dev/null || true; fi

EXPOSE 3000
CMD ["node", "dist/index.js"]
