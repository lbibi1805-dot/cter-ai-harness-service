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
# File runtime can thiet (doc theo src/config.ts:30-31)
COPY system-prompt.md ./system-prompt.md
COPY knowledge.md ./knowledge.md
COPY .vault-manifest.json ./.vault-manifest.json
COPY documents-vault ./documents-vault

# Tao thu muc data de mount volume persistent
RUN mkdir -p /app/data

EXPOSE 3000
CMD ["node", "dist/index.js"]
