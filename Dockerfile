# =========================
# Stage 1: Build
# =========================
FROM node:24-alpine AS builder

WORKDIR /app

# Installer TOUTES les dépendances (dev incluses)
COPY package*.json ./
RUN npm ci --legacy-peer-deps

# Copier le code et builder
COPY . .
RUN npm run build


# =========================
# Stage 2: Runtime (PROD)
# =========================
FROM node:24-alpine

WORKDIR /app

ENV NODE_ENV=production

# User non-root
RUN addgroup -S app && adduser -S app -G app

# Copier uniquement le nécessaire
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Supprimer les devDependencies en prod
RUN npm prune --omit=dev \
 && chown -R app:app /app

USER app

EXPOSE 4243

CMD ["node", "dist/main.js"]
