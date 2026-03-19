import { parsePositiveInt } from '../helpers/number'
import { acquireLease, heartbeatLease, releaseLease } from './download-lease'
import type { ProxyDownloadInput } from '../types/proxy-download'

const buildDownloadHeaders = (originHeaders: Headers, fileName: string) => {
  const headers = new Headers(originHeaders)
  headers.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`)
  return headers
}

export const proxyDownload = async ({
  request,
  env,
  ctx,
  originRequest,
  ticketPayload,
  errorResponse,
}: ProxyDownloadInput) => {
  if (request.method === 'HEAD') {
    const originResponse = await fetch(originRequest)
    return new Response(null, {
      status: originResponse.status,
      statusText: originResponse.statusText,
      headers: buildDownloadHeaders(originResponse.headers, ticketPayload.n),
    })
  }

  const limiterId = env.DOWNLOAD_LIMITER.idFromName(ticketPayload.sid)
  const limiter = env.DOWNLOAD_LIMITER.get(limiterId)
  const heartbeatMs = parsePositiveInt(env.DOWNLOAD_HEARTBEAT_MS, 15_000)
  const maxConnCap = parsePositiveInt(env.DOWNLOAD_MAX_CONNS_CAP, 8)
  const maxConn = Math.max(1, Math.min(ticketPayload.mc, maxConnCap))
  const acquireResult = await acquireLease(limiter, maxConn)

  if (!acquireResult.ok) {
    const res = errorResponse(429, 'Too Many Concurrent Download Connections')
    res.headers.set('Retry-After', '1')
    return res
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
    const bytes = contentLength ? parseInt(contentLength, 10) : 0
    const { readable, writable } = contentLength
      ? new FixedLengthStream(bytes)
      : new TransformStream()
    ctx.waitUntil(
      originResponse.body
        .pipeTo(writable)
        .catch(() => undefined)
        .finally(() => {
          releaseLeaseOnce()
          if (bytes > 0) {
            env.DOWNLOAD_ANALYTICS.writeDataPoint({
              indexes: [ticketPayload.fid.toString()],
              blobs: [ticketPayload.n],
              doubles: [bytes],
            })
          }
        }),
    )

    return new Response(readable, {
      status: originResponse.status,
      statusText: originResponse.statusText,
      headers: buildDownloadHeaders(originResponse.headers, ticketPayload.n),
    })
  } catch (error) {
    await releaseLeaseOnce()

    return errorResponse(
      502,
      `Failed to proxy download: ${error instanceof Error ? error.message : 'unknown error'}`,
    )
  }
}
