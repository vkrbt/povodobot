# syntax=docker/dockerfile:1
FROM node:22-slim AS base

# Системный Chromium для Puppeteer (вместо bundled — экономит размер образа)
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium \
      fonts-liberation \
      fonts-noto-color-emoji \
      fonts-noto-cjk \
      ca-certificates \
      tini \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production

WORKDIR /app

# ---------- build stage ----------
FROM base AS build

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---------- prod deps stage ----------
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# ---------- runtime ----------
FROM base AS runner

COPY --from=deps  /app/node_modules ./node_modules
COPY --from=build /app/dist          ./dist
COPY package.json ./

# Chromium корректно завершается под tini
ENTRYPOINT ["tini", "--"]
CMD ["node", "dist/index.js"]
