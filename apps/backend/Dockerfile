FROM node:24-bookworm-slim AS builder

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    openssl \
    clamav \
    clamav-freshclam \
    p7zip-full \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable

WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/patches apps/frontend/patches

RUN pnpm install --frozen-lockfile --filter shionlib-backend...

COPY apps/backend apps/backend

RUN DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres?schema=public \
  pnpm --filter shionlib-backend prisma:generate
RUN pnpm --filter shionlib-backend build

FROM node:24-bookworm-slim AS runner

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable

WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/patches apps/frontend/patches

RUN pnpm install --frozen-lockfile --prod --filter shionlib-backend...

COPY --from=builder /app/apps/backend/prisma apps/backend/prisma
COPY --from=builder /app/apps/backend/prisma.config.ts apps/backend/prisma.config.ts
COPY --from=builder /app/apps/backend/i18n apps/backend/i18n
COPY --from=builder /app/apps/backend/dist apps/backend/dist

RUN DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres?schema=public \
  pnpm --filter shionlib-backend prisma:generate

WORKDIR /app/apps/backend

EXPOSE 5000

CMD ["sh", "-c", "pnpm prisma:push && node dist/main.js"]
