# ADR 0007: Server-Sent Events for realtime notifications

## Context
The legacy backend pushed message notifications over socket.io with a Redis adapter. The only realtime use is "a new message arrived" and "unread count changed" for the signed-in user. The web client is being rewritten.

## Decision
Expose `GET /message/stream` as an SSE endpoint authenticated like any other route. Each API process holds one Redis pattern subscription (`<prefix>:realtime:user:*`) in `platform/realtime.Hub` and fans events out to local streams through bounded channels; slow consumers drop events instead of blocking. Business code publishes through the `message.Notifier` port after the transaction commits.

## Alternatives
A Go socket.io server (large, protocol-heavy dependency for two events); WebSockets (bidirectional transport is unnecessary).

## Consequences
The legacy web client loses live notifications against the Go backend until the new client adopts the stream; it still reads counts over HTTP. Reverse proxies must not buffer `text/event-stream` (`X-Accel-Buffering: no` is set).
