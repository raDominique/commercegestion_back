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
  npm ci
COPY . .
RUN npm run build
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
