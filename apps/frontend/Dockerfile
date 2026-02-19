FROM node:24-bookworm-slim AS builder

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NEXT_TELEMETRY_DISABLED=1

RUN corepack enable

WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/frontend/package.json apps/frontend/package.json
COPY apps/frontend/patches apps/frontend/patches

RUN pnpm install --frozen-lockfile --filter shionlib-frontend...

COPY apps/frontend apps/frontend

ARG INTERNAL_API_BASE_URL=http://backend:5000
ARG NEXT_PUBLIC_PROD_API_PATH=/api
ARG NEXT_PUBLIC_SHIONLIB_IMAGE_BED_HOST=images.yurari.moe
ARG NEXT_PUBLIC_SHIONLIB_IMAGE_BED_URL=https://images.yurari.moe
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ARG NEXT_PUBLIC_SOCKETIO_URL=http://localhost:5001

ENV INTERNAL_API_BASE_URL=${INTERNAL_API_BASE_URL}
ENV NEXT_PUBLIC_PROD_API_PATH=${NEXT_PUBLIC_PROD_API_PATH}
ENV NEXT_PUBLIC_SHIONLIB_IMAGE_BED_HOST=${NEXT_PUBLIC_SHIONLIB_IMAGE_BED_HOST}
ENV NEXT_PUBLIC_SHIONLIB_IMAGE_BED_URL=${NEXT_PUBLIC_SHIONLIB_IMAGE_BED_URL}
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
ENV NEXT_PUBLIC_SOCKETIO_URL=${NEXT_PUBLIC_SOCKETIO_URL}

RUN pnpm --filter shionlib-frontend build \
  || pnpm --filter shionlib-frontend build \
  || pnpm --filter shionlib-frontend build

RUN cd apps/frontend && \
  APP_SERVER_PATH="$(find .next/standalone -type f -path '*/apps/frontend/server.js' | head -n 1)" && \
  if [ -z "${APP_SERVER_PATH}" ]; then \
  echo "unable to locate standalone server.js for frontend" && \
  find .next/standalone -maxdepth 6 -type f | sed -n '1,120p' && \
  exit 1; \
  fi && \
  APP_STANDALONE_DIR="$(dirname "${APP_SERVER_PATH}")" && \
  APP_SERVER_REL_PATH="${APP_SERVER_PATH#.next/standalone/}" && \
  cp -r public "${APP_STANDALONE_DIR}/" && \
  mkdir -p "${APP_STANDALONE_DIR}/.next" && \
  cp -r .next/static "${APP_STANDALONE_DIR}/.next/" && \
  printf "require('./%s')\n" "${APP_SERVER_REL_PATH}" > .next/standalone/server.js

FROM node:24-bookworm-slim AS runner

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

WORKDIR /app

COPY --from=builder /app/apps/frontend/.next/standalone ./

EXPOSE 3000

CMD ["node", "server.js"]
