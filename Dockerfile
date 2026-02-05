# =========================
# Build stage
# =========================
FROM node:24-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production --legacy-peer-deps

COPY . .
RUN npm run build


# =========================
# Runtime stage
# =========================
FROM node:24-alpine

WORKDIR /app

ENV NODE_ENV=production

# Création user non-root
RUN addgroup -S app && adduser -S app -G app

# Copier uniquement le nécessaire
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Sécurisation des permissions
RUN chown -R app:app /app

USER app

EXPOSE 4243

CMD ["node", "dist/main.js"]
