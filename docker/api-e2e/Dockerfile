# syntax=docker/dockerfile:1.7
FROM golang:1.27-trixie AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download
COPY . .
RUN --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/devtool ./cmd/devtool

FROM debian:trixie-slim
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates tzdata \
  && rm -rf /var/lib/apt/lists/*
COPY --from=build /out/devtool /usr/local/bin/devtool
ENTRYPOINT ["devtool"]
CMD ["e2e", "prepare"]
