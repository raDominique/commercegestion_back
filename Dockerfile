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

# Mode développement par défaut selon votre besoin
ENV NODE_ENV=development

# Création d'un utilisateur non-root pour la sécurité
RUN addgroup -S app && adduser -S app -G app

# Copie des fichiers compilés et des modules nécessaires
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Création du dossier d'upload et gestion des permissions
# /app/upload est le dossier où NestJS enregistre les fichiers
RUN mkdir -p /app/upload \
    && chown -R app:app /app/upload \
    && chmod -R 775 /app/upload \
    && chown -R app:app /app

# Nettoyage des dépendances de développement pour alléger l'image
RUN npm prune --omit=dev

USER app

EXPOSE 4243

# Définition du point de montage pour la persistance
VOLUME ["/app/upload"]

CMD ["node", "dist/main.js"]