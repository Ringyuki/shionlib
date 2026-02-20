FROM oven/bun:1.2 AS builder

WORKDIR /app

# Install dependencies first (layer cache)
COPY apps/og/package.json ./
COPY apps/og/tsconfig.json ./
RUN bun install --frozen-lockfile

# Copy source and assets
COPY apps/og/src ./src
COPY apps/og/assets ./assets

# ---- runtime ----
FROM oven/bun:1.2-slim AS runner

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/assets ./assets
COPY --from=builder /app/tsconfig.json ./tsconfig.json

ENV NODE_ENV=production

EXPOSE 4000

CMD ["bun", "src/server.ts"]
