# syntax=docker/dockerfile:1.7
FROM --platform=$BUILDPLATFORM golang:1.27-trixie AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download
COPY . .
ARG TARGETOS
ARG TARGETARCH
RUN --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH \
    go build -trimpath -ldflags="-s -w" -o /out/shionlib-api ./cmd/api

FROM --platform=$BUILDPLATFORM debian:trixie-slim AS sevenzip
ARG TARGETARCH
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl xz-utils \
  && rm -rf /var/lib/apt/lists/*
RUN set -eu; \
    case "$TARGETARCH" in \
      amd64) arch=x64; sum=4ca3b7c6f2f67866b92622818b58233dc70367be2f36b498eb0bdeaaa44b53f4 ;; \
      arm64) arch=arm64; sum=39c5140f02ce4436599303c59a149f654cb1bbc47cdc105a942120d747ae040d ;; \
      *) echo "unsupported architecture $TARGETARCH" >&2; exit 1 ;; \
    esac; \
    curl -fsSLo /tmp/7z.tar.xz "https://www.7-zip.org/a/7z2501-linux-${arch}.tar.xz"; \
    echo "$sum  /tmp/7z.tar.xz" | sha256sum -c -; \
    tar -xJf /tmp/7z.tar.xz -C /tmp 7zzs; \
    install -D -m 0755 /tmp/7zzs /out/7zz

FROM debian:trixie-slim
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates tzdata postgresql-client \
  && rm -rf /var/lib/apt/lists/* \
  && useradd --system --uid 10001 --user-group --home-dir /var/lib/shionlib --create-home shionlib \
  && install -d -o shionlib -g shionlib /var/lib/shionlib/upload /var/lib/shionlib/scan-logs
COPY --from=sevenzip /out/7zz /usr/local/bin/7zz
COPY --from=build /out/shionlib-api /usr/local/bin/shionlib-api
ARG VERSION=dev
ENV APP_VERSION=$VERSION \
    PORT=5000 \
    FILE_UPLOAD_ROOT_DIR=/var/lib/shionlib/upload \
    FILE_SCAN_LOG_DIR=/var/lib/shionlib/scan-logs \
    ARCHIVE_TOOL_PATH=7zz \
    DATABASE_BACKUP_PG_DUMP_PATH=pg_dump
USER shionlib
WORKDIR /var/lib/shionlib
EXPOSE 5000
ENTRYPOINT ["shionlib-api"]
CMD ["serve"]
