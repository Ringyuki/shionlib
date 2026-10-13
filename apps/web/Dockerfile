# syntax=docker/dockerfile:1.7
FROM node:24-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

FROM base AS build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM base AS runtime-deps
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --prod

FROM node:24-bookworm-slim
ENV NODE_ENV=production PORT=3000
WORKDIR /app
COPY --from=runtime-deps /app/package.json ./package.json
COPY --from=runtime-deps /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY server.js ./server.js
ARG VERSION=dev
ENV APP_VERSION=$VERSION
USER node
EXPOSE 3000
CMD ["node", "server.js"]
