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

# Créer le dossier upload et donner les permissions
RUN mkdir -p /app/upload \
 && chown -R app:app /app/upload \
 && chmod -R 775 /app/upload \
 && chown -R app:app /app

# Supprimer les devDependencies en prod
RUN npm prune --omit=dev

USER app

EXPOSE 4243

CMD ["node", "dist/main.js"]
