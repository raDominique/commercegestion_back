# =========================
# Stage 1: Build
# =========================
FROM node:24-alpine AS builder

WORKDIR /app

# Installation des dépendances
COPY package*.json ./
RUN npm ci --legacy-peer-deps

# Copie du code source et compilation
COPY . .
RUN npm run build
# =========================
# Stage 2: Runtime (PROD)
# =========================
FROM node:24-alpine

WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -S app && adduser -S app -G app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

RUN mkdir -p /app/upload \
    && chown -R app:app /app \
    && chmod -R 775 /app/upload

RUN npm prune --omit=dev

USER app
EXPOSE 4243

CMD ["node", "dist/main.js"]