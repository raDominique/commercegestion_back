# syntax=docker/dockerfile:1.4

# Stage 1: Base with build dependencies
FROM node:24-alpine AS base
RUN apk add --no-cache \
  gcc \
  g++ \
  make \
  python3 \
  cairo-dev \
  pango-dev \
  jpeg-dev \
  giflib-dev \
  librsvg-dev

# Stage 2: Install ALL dependencies and build the app
FROM base AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
  npm ci --prefer-offline --no-audit --no-fund
COPY . .

# Build incrémental : on restaure dist + .tsbuildinfo depuis le cache BuildKit,
# tsc ne recompile alors que les fichiers modifiés (au lieu de tout recompiler
# à chaque pipeline). `nest build` n'est pas utilisé car deleteOutDir: true
# supprimerait dist/ et le .tsbuildinfo, annulant tout gain d'incrémental.
# Les assets (templates mail .hbs) sont copiés manuellement comme nest-cli le
# faisait via compilerOptions.assets.
RUN --mount=type=cache,id=tsbuild-cache,target=/app/.tsbuild \
  sh -c " \
    if [ -d /app/.tsbuild/dist ]; then cp -a /app/.tsbuild/dist/. /app/dist/ 2>/dev/null || true; fi; \
    if [ -f /app/.tsbuild/tsconfig.build.tsbuildinfo ]; then cp /app/.tsbuild/tsconfig.build.tsbuildinfo /app/tsconfig.build.tsbuildinfo 2>/dev/null || true; fi; \
    npx tsc -p tsconfig.build.json; \
    mkdir -p /app/dist/shared/mail && cp -a /app/src/shared/mail/templates /app/dist/shared/mail/; \
    rm -rf /app/.tsbuild; \
    mkdir -p /app/.tsbuild; \
    cp -a /app/dist /app/.tsbuild/dist; \
    cp -a /app/tsconfig.build.tsbuildinfo /app/.tsbuild/ 2>/dev/null || true; \
  "

# Strip dev dependencies so only production modules ship in the final image.
# This replaces a separate `prod-deps` stage: ONE npm ci + ONE native
# compilation (bcrypt/sharp) instead of two, which halves the build time.
RUN npm prune --omit=dev

# Stage 3: Final production image
FROM node:24-alpine
RUN apk add --no-cache \
  cairo \
  pango \
  jpeg \
  giflib \
  librsvg \
  tini

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy only the necessary files from previous stages
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

RUN mkdir -p upload && chown -R appuser:appgroup /app

USER appuser

EXPOSE 4243

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main"]
