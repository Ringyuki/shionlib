import { parsePositiveInt } from '../helpers/number'
import { acquireLease, heartbeatLease, releaseLease } from './download-lease'
import type { Env } from '../types/env'
import type { DownloadRequestContext } from '../types/download-request-context'

type ProxyDownloadInput = DownloadRequestContext & {
  request: Request
  env: Env
  ctx: ExecutionContext
}

export const proxyDownload = async ({
  request,
  env,
  ctx,
  originRequest,
  ticketPayload,
}: ProxyDownloadInput) => {
  if (request.method === 'HEAD') {
    return fetch(originRequest)
  }

  const limiterId = env.DOWNLOAD_LIMITER.idFromName(ticketPayload.sid)
  const limiter = env.DOWNLOAD_LIMITER.get(limiterId)
  const heartbeatMs = parsePositiveInt(env.DOWNLOAD_HEARTBEAT_MS, 15_000)
  const maxConnCap = parsePositiveInt(env.DOWNLOAD_MAX_CONNS_CAP, 8)
  const maxConn = Math.max(1, Math.min(ticketPayload.mc, maxConnCap))
  const acquireResult = await acquireLease(limiter, maxConn)

  if (!acquireResult.ok) {
    return new Response('Too Many Concurrent Download Connections', {
      status: 429,
      headers: {
        'Retry-After': '1',
      },
    })
  }

  let released = false
  let heartbeatHandle: ReturnType<typeof setInterval> | undefined

  const releaseLeaseOnce = async () => {
    if (released) return
    released = true
    if (heartbeatHandle) clearInterval(heartbeatHandle)
    await releaseLease(limiter, acquireResult.leaseId)
  }

  try {
    const originResponse = await fetch(originRequest)
    if (!originResponse.ok && originResponse.status !== 206) {
      await releaseLeaseOnce()
      return originResponse
    }

    if (!originResponse.body) {
      await releaseLeaseOnce()
      return originResponse
    }

    heartbeatHandle = setInterval(
      () => {
        ctx.waitUntil(heartbeatLease(limiter, acquireResult.leaseId))
      },
      Math.min(heartbeatMs, acquireResult.heartbeatMs),
    )

    const contentLength = originResponse.headers.get('content-length')
    const { readable, writable } = contentLength
      ? new FixedLengthStream(parseInt(contentLength, 10))
      : new TransformStream()
    ctx.waitUntil(
      originResponse.body
        .pipeTo(writable)
        .catch(() => undefined)
        .finally(() => releaseLeaseOnce()),
    )

    return new Response(readable, {
      status: originResponse.status,
      statusText: originResponse.statusText,
      headers: new Headers(originResponse.headers),
    })
  } catch (error) {
    await releaseLeaseOnce()

    return new Response(
      `Failed to proxy download: ${error instanceof Error ? error.message : 'unknown error'}`,
      {
        status: 502,
      },
    )
  }
}
