FROM node:24-alpine AS builder

WORKDIR /app

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

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src/ src/

RUN npm run build
RUN npm prune --production

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

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

RUN mkdir -p upload && chown -R appuser:appgroup /app

USER appuser

EXPOSE 4243

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main"]
